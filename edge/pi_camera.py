import io
import logging
import shutil
import subprocess
import threading
import time
from typing import Optional, Tuple

from PIL import Image

logger = logging.getLogger("PiCamera")


class PiCameraCapture:
    """
    Raspberry Pi CSI camera capture driver (tested with OV5647 via libcamera).

    Prefers the official `picamera2` Python binding so the camera stream stays
    warm with settled AE/AWB across captures. Falls back to `rpicam-still` /
    `libcamera-still` if `picamera2` is not installed in the active environment.
    """

    def __init__(
        self,
        width: int = 1296,
        height: int = 972,
        warmup_sec: float = 1.0,
        hflip: bool = False,
        vflip: bool = False,
        camera_num: int = 0
    ):
        self.width = width
        self.height = height
        self.warmup_sec = warmup_sec
        self.hflip = hflip
        self.vflip = vflip
        self.camera_num = camera_num

        self._lock = threading.Lock()
        self._picam2 = None
        self._cli_binary: Optional[str] = None
        self.backend: Optional[str] = None
        self.camera_model: Optional[str] = None
        self._started = False

    @staticmethod
    def _find_cli_binary() -> Optional[str]:
        for name in ("rpicam-still", "libcamera-still"):
            path = shutil.which(name)
            if path:
                return path
        return None

    @classmethod
    def is_available(cls, camera_num: int = 0) -> bool:
        try:
            from picamera2 import Picamera2
            cameras = Picamera2.global_camera_info()
            if cameras and camera_num < len(cameras):
                return True
        except Exception:
            pass

        cli = cls._find_cli_binary()
        if cli:
            hello = shutil.which("rpicam-hello") or shutil.which("libcamera-hello")
            if hello:
                try:
                    res = subprocess.run(
                        [hello, "--list-cameras"],
                        capture_output=True,
                        text=True,
                        timeout=5
                    )
                    output = f"{res.stdout}\n{res.stderr}"
                    return "Available cameras" in output and "No cameras available" not in output
                except Exception:
                    return False
        return False

    def start(self) -> bool:
        with self._lock:
            if self._started:
                return True

            if self._start_picamera2():
                self._started = True
                return True

            if self._start_cli_fallback():
                self._started = True
                return True

            logger.error("No Raspberry Pi CSI camera backend available (picamera2 or rpicam-still).")
            return False

    def _start_picamera2(self) -> bool:
        try:
            from picamera2 import Picamera2
            from libcamera import Transform
        except ImportError:
            logger.debug("picamera2 not installed; will try rpicam-still fallback.")
            return False
        except Exception as e:
            logger.warning(f"Failed to import picamera2: {e}")
            return False

        picam2 = None
        try:
            cameras = Picamera2.global_camera_info()
            if not cameras or self.camera_num >= len(cameras):
                logger.warning("picamera2 detected no CSI cameras.")
                return False

            cam_info = cameras[self.camera_num]
            self.camera_model = cam_info.get("Model", "unknown")

            picam2 = Picamera2(camera_num=self.camera_num)
            transform = Transform(hflip=int(self.hflip), vflip=int(self.vflip))
            config = picam2.create_video_configuration(
                main={"size": (self.width, self.height), "format": "BGR888"},
                transform=transform
            )
            picam2.configure(config)
            picam2.start()

            if self.warmup_sec > 0:
                time.sleep(self.warmup_sec)

            self._picam2 = picam2
            self.backend = "picamera2"
            logger.info(
                f"Pi CSI camera started via picamera2 "
                f"(model={self.camera_model}, resolution={self.width}x{self.height}, "
                f"hflip={self.hflip}, vflip={self.vflip})"
            )
            return True
        except Exception as e:
            logger.warning(f"Failed to initialize picamera2: {e}")
            if picam2 is not None:
                try:
                    picam2.stop()
                except Exception:
                    pass
                try:
                    picam2.close()
                except Exception:
                    pass
            return False

    def _start_cli_fallback(self) -> bool:
        cli = self._find_cli_binary()
        if not cli:
            return False
        self._cli_binary = cli
        self.backend = "rpicam-still"
        logger.info(
            f"Pi CSI camera configured via CLI fallback ({cli}, "
            f"resolution={self.width}x{self.height})"
        )
        return True

    def capture_frame(self) -> Optional[Image.Image]:
        if not self._started:
            if not self.start():
                return None

        with self._lock:
            if not self._started:
                return None

            if self.backend == "picamera2" and self._picam2 is not None:
                try:
                    img = self._picam2.capture_image("main")
                    if img.mode != "RGB":
                        img = img.convert("RGB")
                    return img
                except Exception as e:
                    logger.error(f"picamera2 frame capture error: {e}")
                    return None

            if self.backend == "rpicam-still" and self._cli_binary is not None:
                return self._capture_cli_frame()

            return None

    def _capture_cli_frame(self) -> Optional[Image.Image]:
        cmd = [
            self._cli_binary,
            "--nopreview",
            "--immediate",
            "-t", "500",
            "--width", str(self.width),
            "--height", str(self.height),
            "--encoding", "jpg",
            "--camera", str(self.camera_num),
            "-o", "-"
        ]
        if self.hflip:
            cmd.append("--hflip")
        if self.vflip:
            cmd.append("--vflip")

        try:
            res = subprocess.run(cmd, capture_output=True, timeout=10)
            if res.returncode != 0 or not res.stdout:
                err = res.stderr.decode("utf-8", errors="replace").strip()
                logger.error(f"{self._cli_binary} capture failed (rc={res.returncode}): {err}")
                return None
            img = Image.open(io.BytesIO(res.stdout))
            img.load()
            return img.convert("RGB")
        except Exception as e:
            logger.error(f"CLI Pi camera capture error: {e}")
            return None

    def stop(self):
        with self._lock:
            self._started = False
            if self._picam2 is not None:
                try:
                    self._picam2.stop()
                except Exception as e:
                    logger.debug(f"Ignoring picamera2 stop error: {e}")
                try:
                    self._picam2.close()
                except Exception as e:
                    logger.debug(f"Ignoring picamera2 close error: {e}")
                self._picam2 = None
            self.backend = None
            logger.info("Pi CSI camera closed.")

    def close(self):
        self.stop()

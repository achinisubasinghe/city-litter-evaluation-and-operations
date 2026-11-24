import argparse
import collections
import io
import logging
import os
import signal
import sys
import threading
import time
from typing import Optional, Tuple, Dict, Any, Union, Deque

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from gps_tracker import GPSReader
from mpu6050_sensor import MPU6050
from location_fusion import LocationFusionCorrector
from camera_quality import CameraQualityChecker
from offline_storage import OfflineStorage
from sync_service import ConvexSyncService
from pi_camera import PiCameraCapture

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
logger = logging.getLogger("EdgePipeline")


_RESAMPLE_BILINEAR = getattr(getattr(Image, "Resampling", Image), "BILINEAR")
_RESAMPLE_BOX = getattr(getattr(Image, "Resampling", Image), "BOX", _RESAMPLE_BILINEAR)


def compute_dhash(img_pil: Image.Image, hash_size: int = 8) -> int:
    """
    Computes a 64-bit perceptual difference hash (dHash) using area-averaging
    BOX resampling so fine roadside foliage/texture does not alias.
    """
    gray = img_pil.convert("L").resize((hash_size + 1, hash_size), _RESAMPLE_BOX)
    pixels = np.asarray(gray, dtype=np.int16)
    diff = pixels[:, 1:] > pixels[:, :-1]
    bits = 0
    for bit in diff.flatten():
        bits = (bits << 1) | int(bit)
    return bits


def dhash_hamming_distance(h1: int, h2: int) -> int:
    """Returns Hamming distance (0..64) between two integer perceptual hashes."""
    xor_val = h1 ^ h2
    if hasattr(xor_val, "bit_count"):
        return xor_val.bit_count()
    return bin(xor_val).count("1")


class DetectionResult(tuple):
    def __new__(
        cls,
        is_litter: bool,
        confidence: float,
        incident_id: Optional[str],
        quality: Optional[Dict[str, Any]] = None,
        suppressed: bool = False,
        suppression_reason: Optional[str] = None
    ):
        obj = super().__new__(cls, (is_litter, confidence, incident_id))
        obj.is_litter = is_litter
        obj.confidence = confidence
        obj.incident_id = incident_id
        obj.quality = quality or {}
        obj.suppressed = suppressed
        obj.suppression_reason = suppression_reason
        return obj


class LitterClassifier:
    def __init__(self, model_path: str, allow_mock: bool = False):
        self.model_path = model_path
        self.allow_mock = allow_mock
        self.backend = None
        self.session = None
        self.torch_model = None
        self.input_name = None
        self.output_name = None
        self._load_model()

    def _load_model(self):
        if not os.path.exists(self.model_path):
            resolved_default = None
            if not os.path.isabs(self.model_path) and os.path.basename(self.model_path) in (
                "trash_classifier_384.onnx",
                "trash_classifier_384.pt",
            ):
                project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
                candidates = [
                    os.path.join(project_root, self.model_path),
                    os.path.join(project_root, "models", "trash_classifier_384.onnx"),
                    os.path.join(project_root, "models", "trash_classifier_384.pt"),
                ]
                for cand in candidates:
                    if os.path.exists(cand):
                        resolved_default = cand
                        break

            if resolved_default is not None:
                self.model_path = resolved_default
            else:
                msg = f"Model file not found at '{self.model_path}'."
                if self.allow_mock:
                    logger.warning(f"{msg} Using mock classifier because allow_mock=True.")
                    return
                logger.error(msg)
                raise RuntimeError(msg)

        last_error: Optional[Exception] = None

        if self.model_path.endswith(".pt"):
            try:
                import torch
                self.torch_model = torch.jit.load(self.model_path, map_location="cpu")
                self.torch_model.eval()
                self.backend = "torch"
                logger.info(f"Loaded TorchScript model: {self.model_path}")
                return
            except Exception as e:
                last_error = e
                logger.warning(f"Failed to load TorchScript model: {e}")

        try:
            import onnxruntime as ort
            options = ort.SessionOptions()
            options.intra_op_num_threads = 2
            options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
            self.session = ort.InferenceSession(self.model_path, options, providers=['CPUExecutionProvider'])
            self.input_name = self.session.get_inputs()[0].name
            self.output_name = self.session.get_outputs()[0].name
            self.backend = "onnx"
            logger.info(f"Loaded ONNX model: {self.model_path}")
            return
        except Exception as e:
            last_error = e
            ext_data_path = f"{self.model_path}.data"
            hint = ""
            if self.model_path.endswith(".onnx") and not os.path.exists(ext_data_path):
                hint = f" (Note: external weights file '{ext_data_path}' is missing if model was exported with external data.)"
            msg = f"Could not initialize ONNX Runtime for '{self.model_path}': {e}{hint}"
            if self.allow_mock:
                logger.warning(f"{msg} Falling back to mock classifier because allow_mock=True.")
                return
            logger.error(msg)
            raise RuntimeError(msg) from last_error

    def preprocess_np(self, img_pil: Image.Image) -> np.ndarray:
        img = img_pil.convert('RGB').resize((384, 384), _RESAMPLE_BILINEAR)
        arr = np.array(img, dtype=np.float32) / 255.0
        mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
        std = np.array([0.229, 0.224, 0.225], dtype=np.float32)
        arr = (arr - mean) / std
        tensor = np.transpose(arr, (2, 0, 1))
        return np.expand_dims(tensor, axis=0)

    def predict(self, img_pil: Image.Image) -> float:
        if self.backend == "torch":
            import torch
            tensor_np = self.preprocess_np(img_pil)
            tensor = torch.from_numpy(tensor_np)
            with torch.no_grad():
                out = self.torch_model(tensor)
                raw_val = float(out.item())
        elif self.backend == "onnx":
            tensor_np = self.preprocess_np(img_pil)
            outputs = self.session.run([self.output_name], {self.input_name: tensor_np})
            raw_val = float(outputs[0][0][0] if np.ndim(outputs[0]) > 1 else outputs[0][0])
        elif self.allow_mock:
            return 0.88
        else:
            raise RuntimeError("Classifier backend is not loaded and mock mode is disabled.")

        if raw_val < 0.0 or raw_val > 1.0:
            prob = 1.0 / (1.0 + np.exp(-raw_val))
        else:
            prob = raw_val
        return float(prob)


class EdgeMasterController:
    def __init__(
        self,
        model_path: str = "models/trash_classifier_384.onnx",
        data_dir: str = "/var/trash_data",
        threshold: float = 0.50,
        lookahead_meters: float = 3.0,
        min_sharpness: float = 35.0,
        check_quality: bool = True,
        stationary_debounce_sec: float = 2.0,
        max_stationary_captures: int = 1,
        suppress_stationary_duplicates: bool = True,
        imu_motion_threshold_g: float = 0.08,
        min_distance_meters: float = 20.0,
        spatial_dedup_window_sec: float = 1800.0,
        visual_dedup_max_hamming: int = 14,
        visual_dedup_history_size: int = 8,
        require_gps_fix: bool = False,
        allow_mock_classifier: bool = False,
        camera_source: str = "auto",
        camera_width: int = 1296,
        camera_height: int = 972,
        camera_hflip: bool = False,
        camera_vflip: bool = False
    ):
        self.threshold = threshold
        self.lookahead_meters = lookahead_meters
        self.check_quality = check_quality
        self.stationary_debounce_sec = stationary_debounce_sec
        self.max_stationary_captures = max_stationary_captures
        self.suppress_stationary_duplicates = suppress_stationary_duplicates
        self.imu_motion_threshold_g = imu_motion_threshold_g
        self.min_distance_meters = min_distance_meters
        self.spatial_dedup_window_sec = spatial_dedup_window_sec
        self.visual_dedup_max_hamming = visual_dedup_max_hamming
        self.require_gps_fix = require_gps_fix
        self.allow_mock_classifier = allow_mock_classifier
        self.camera_source = camera_source
        self.camera_width = camera_width
        self.camera_height = camera_height
        self.camera_hflip = camera_hflip
        self.camera_vflip = camera_vflip

        self.storage = OfflineStorage(data_dir=data_dir)
        self.gps = GPSReader()
        self.classifier = LitterClassifier(model_path, allow_mock=self.allow_mock_classifier)
        self.sync_service = ConvexSyncService(storage=self.storage)
        self.kinect_active = False
        self.pi_camera: Optional[PiCameraCapture] = None
        self._picam_unavailable = False

        self.imu = MPU6050(
            allow_mock=True,
            motion_threshold_g=self.imu_motion_threshold_g,
            stationary_debounce_sec=self.stationary_debounce_sec
        )
        self.location_corrector = LocationFusionCorrector(
            gps_reader=self.gps,
            imu_sensor=self.imu,
            lookahead_distance_meters=self.lookahead_meters
        )
        self.quality_checker = CameraQualityChecker(
            min_sharpness=min_sharpness,
            min_brightness=30.0,
            max_brightness=230.0,
            max_vibration_g=0.35
        )

        self.running = False
        self.was_stationary = False
        self.stationary_captures_count = 0
        self._recent_visual_hashes: Deque[int] = collections.deque(maxlen=max(1, visual_dedup_history_size))
        self._load_recent_visual_hashes()

    def _load_recent_visual_hashes(self):
        try:
            recent_hex = self.storage.get_recent_visual_hashes(
                limit=self._recent_visual_hashes.maxlen or 8,
                window_seconds=self.spatial_dedup_window_sec if self.spatial_dedup_window_sec > 0 else None
            )
            for h_hex in reversed(recent_hex):
                try:
                    self._recent_visual_hashes.append(int(h_hex, 16))
                except ValueError:
                    pass
        except Exception as e:
            logger.debug(f"Could not seed recent visual hashes from storage: {e}")

    def start(self):
        self.running = True
        logger.info("Starting GPS background tracker...")
        self.gps.start()

        logger.info("Starting GPS + IMU Location Fusion Engine...")
        self.location_corrector.start()

        sync_thread = threading.Thread(
            target=self.sync_service.run_daemon,
            kwargs={"check_interval": 10},
            daemon=True
        )
        sync_thread.start()
        logger.info("Cloud sync daemon running.")

    def reset_stationary_state(self):
        self.was_stationary = False
        self.stationary_captures_count = 0

    def encode_incident_image(self, img_pil: Image.Image, quality: int = 90) -> bytes:
        buf = io.BytesIO()
        img_pil.save(buf, format="JPEG", quality=quality)
        return buf.getvalue()

    def evaluate_frame(
        self,
        img_pil: Image.Image,
        img_bytes: Optional[bytes] = None,
        capture_time: Optional[float] = None
    ) -> DetectionResult:
        t_capture = capture_time if capture_time is not None else time.time()

        motion_data = None
        is_moving = True
        is_stationary = False
        stationary_duration = 0.0

        if self.imu:
            try:
                if self.location_corrector.running:
                    motion_data = self.imu.get_latest_reading()
                else:
                    motion_data = self.imu.read_raw_data()
                is_moving = motion_data.get("is_moving", True)
                is_stationary = motion_data.get("is_stationary", not is_moving)
                stationary_duration = motion_data.get("stationary_duration_sec", 0.0)
            except Exception:
                pass

        gps_speed = None
        gps_has_fix = False
        gps_is_mock = True
        if self.gps and hasattr(self.gps, "get_location"):
            try:
                gps_state = self.gps.get_location()
                gps_speed = gps_state.get("speed_kmh")
                gps_has_fix = bool(gps_state.get("has_fix", False))
                gps_is_mock = bool(gps_state.get("is_mock", False))
            except Exception:
                pass

        # Fuse real GPS ground speed with IMU so idling engine vibration does not
        # falsely reset stationary suppression when parked or stopped in traffic.
        if gps_has_fix and not gps_is_mock and gps_speed is not None:
            if gps_speed >= 3.0:
                is_moving = True
                is_stationary = False
            elif gps_speed < 1.5:
                is_moving = False
                is_stationary = True
            else:
                # Hysteresis band (1.5 - 3.0 km/h) prevents GPS noise from breaking stationary lock
                is_moving = (not self.was_stationary) and is_moving
                is_stationary = not is_moving
        elif gps_speed is not None and gps_speed > 2.5:
            is_moving = True
            is_stationary = False

        if is_moving:
            if self.was_stationary:
                logger.info("Device motion resumed. Resetting stationary capture count.")
                self.was_stationary = False
                self.stationary_captures_count = 0
        else:
            if not self.was_stationary:
                logger.info(f"Device stationary confirmed (dwelling for {stationary_duration:.1f}s).")
                self.was_stationary = True
                self.stationary_captures_count = 0

        quality = {}
        if self.check_quality:
            quality = self.quality_checker.evaluate_quality(img_pil, imu_motion_data=motion_data)
            if not quality["is_acceptable"]:
                logger.warning(
                    f"[QUALITY REJECTED] Frame discarded due to camera quality issues: {quality['issues']} "
                    f"(Sharpness: {quality['sharpness_score']:.1f}, Brightness: {quality['brightness_score']:.1f}, "
                    f"Vibration: {quality['vibration_g']:.2f}g). Skipping detection."
                )
                return DetectionResult(
                    is_litter=False,
                    confidence=0.0,
                    incident_id=None,
                    quality=quality
                )

        confidence = self.classifier.predict(img_pil)
        is_litter = confidence >= self.threshold

        if not is_litter:
            logger.info(
                f"Frame: [CLEAN] (Confidence: {confidence * 100:.1f}%) | "
                f"Camera Quality: {int(quality.get('quality_score', 1.0) * 100)}% "
                f"(Sharpness: {quality.get('sharpness_score', 0.0):.1f}) | Moving: {is_moving} | "
                f"Stationary: {is_stationary} ({stationary_duration:.1f}s)"
            )
            return DetectionResult(
                is_litter=False,
                confidence=confidence,
                incident_id=None,
                quality=quality
            )

        if self.suppress_stationary_duplicates and self.was_stationary:
            if self.stationary_captures_count >= self.max_stationary_captures:
                logger.info(
                    f"Frame: [STATIONARY SUPPRESSED] Device stationary for {stationary_duration:.1f}s at current location. "
                    f"Capture limit reached ({self.stationary_captures_count}/{self.max_stationary_captures}). "
                    f"Skipping duplicate capture."
                )
                return DetectionResult(
                    is_litter=False,
                    confidence=confidence,
                    incident_id=None,
                    quality=quality,
                    suppressed=True,
                    suppression_reason="stationary"
                )

        corr = self.location_corrector.get_corrected_location(
            capture_time=t_capture,
            lookahead_distance=self.lookahead_meters
        )

        if self.require_gps_fix and (not corr["has_gps_fix"] or corr["correction_method"] == "default_fallback"):
            logger.info(
                f"Frame: [NO GPS FIX SUPPRESSED] Litter detected (Confidence: {confidence * 100:.1f}%) "
                f"but no valid GPS fix is available ({corr['correction_method']}). Skipping save."
            )
            return DetectionResult(
                is_litter=False,
                confidence=confidence,
                incident_id=None,
                quality=quality,
                suppressed=True,
                suppression_reason="no_gps_fix"
            )

        if self.min_distance_meters > 0 and corr["correction_method"] != "default_fallback":
            nearby = self.storage.find_nearby_incident(
                latitude=corr["latitude"],
                longitude=corr["longitude"],
                radius_meters=self.min_distance_meters,
                window_seconds=self.spatial_dedup_window_sec,
                now_ms=corr["timestamp"]
            )
            if nearby is not None:
                logger.info(
                    f"Frame: [SPATIAL DUPLICATE SUPPRESSED] Already captured incident {nearby['id'][:8]} "
                    f"{nearby['distance_meters']:.1f}m away (min spacing: {self.min_distance_meters:.1f}m). "
                    f"Skipping duplicate capture."
                )
                return DetectionResult(
                    is_litter=False,
                    confidence=confidence,
                    incident_id=None,
                    quality=quality,
                    suppressed=True,
                    suppression_reason="spatial_duplicate"
                )

        frame_dhash = compute_dhash(img_pil)
        if self.visual_dedup_max_hamming >= 0 and self._recent_visual_hashes:
            min_hamming = min(
                dhash_hamming_distance(frame_dhash, prev_h)
                for prev_h in self._recent_visual_hashes
            )
            if min_hamming <= self.visual_dedup_max_hamming:
                logger.info(
                    f"Frame: [VISUAL DUPLICATE SUPPRESSED] Frame matches recent capture "
                    f"(dHash Hamming={min_hamming} <= {self.visual_dedup_max_hamming}). "
                    f"Skipping duplicate capture."
                )
                return DetectionResult(
                    is_litter=False,
                    confidence=confidence,
                    incident_id=None,
                    quality=quality,
                    suppressed=True,
                    suppression_reason="visual_duplicate"
                )

        logger.info(
            f"Frame: [LITTER DETECTED] (Confidence: {confidence * 100:.1f}%) -> "
            f"Capturing incident image & calculating corrected ground coordinates..."
        )

        captured_bytes = img_bytes if img_bytes is not None else self.encode_incident_image(img_pil, quality=90)

        incident_id = self.storage.save_incident(
            image_bytes=captured_bytes,
            latitude=corr["latitude"],
            longitude=corr["longitude"],
            confidence=confidence,
            has_gps_fix=corr["has_gps_fix"],
            timestamp_ms=corr["timestamp"],
            raw_latitude=corr["raw_latitude"],
            raw_longitude=corr["raw_longitude"],
            is_corrected=corr["is_corrected"],
            correction_method=corr["correction_method"],
            speed_kmh=corr["speed_kmh"],
            heading_deg=corr["heading_deg"],
            offset_meters=corr["total_offset_meters"],
            quality_score=quality.get("quality_score", 1.0),
            blur_score=quality.get("sharpness_score", 100.0),
            visual_hash=f"{frame_dhash:016x}"
        )
        self._recent_visual_hashes.append(frame_dhash)

        if self.was_stationary:
            self.stationary_captures_count += 1
            logger.info(
                f"Stationary capture {self.stationary_captures_count}/{self.max_stationary_captures} "
                f"recorded for current stationary dwell period."
            )

        logger.info(
            f"Incident Saved: ID={incident_id} | Corrected=({corr['latitude']:.6f}, {corr['longitude']:.6f}) "
            f"| Raw=({corr['raw_latitude']:.6f}, {corr['raw_longitude']:.6f}) "
            f"| Offset: {corr['total_offset_meters']:.1f}m @ {corr['heading_deg']:.0f}° ({corr['correction_method']}) "
            f"| Speed: {corr['speed_kmh']:.1f} km/h | ImageSize: {len(captured_bytes)} bytes | "
            f"Camera Quality: {int(quality.get('quality_score', 1.0) * 100)}% (Sharp: {quality.get('sharpness_score', 0.0):.1f})"
        )

        if self.sync_service.check_connectivity():
            uploaded = self.sync_service.sync_batch(batch_size=5)
            logger.info(f"Direct sync status: {uploaded} incident(s) uploaded to Convex.")
        else:
            logger.info("Device offline: Incident safely stored in local queue.")

        return DetectionResult(
            is_litter=True,
            confidence=confidence,
            incident_id=incident_id,
            quality=quality
        )

    def _ensure_picamera(self) -> Optional[PiCameraCapture]:
        if self.pi_camera is not None:
            return self.pi_camera
        cam = PiCameraCapture(
            width=self.camera_width,
            height=self.camera_height,
            hflip=self.camera_hflip,
            vflip=self.camera_vflip
        )
        if cam.start():
            self.pi_camera = cam
            return self.pi_camera
        return None

    def grab_picamera_raw_frame(self) -> Optional[Image.Image]:
        cam = self._ensure_picamera()
        if cam is None:
            return None
        return cam.capture_frame()

    def grab_raw_frame(self, cap=None) -> Optional[Image.Image]:
        if cap is not None:
            ret, frame = cap.read()
            if not ret:
                return None
            import cv2
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            return Image.fromarray(rgb_frame)

        if self.camera_source == "picam":
            return self.grab_picamera_raw_frame()

        if self.camera_source == "kinect":
            return self.grab_kinect_raw_frame()

        # Default "auto": prefer Raspberry Pi CSI camera (OV5647), fall back to Kinect
        if not self._picam_unavailable:
            frame = self.grab_picamera_raw_frame()
            if frame is not None:
                return frame
            if self.pi_camera is None:
                self._picam_unavailable = True
                logger.info("Pi CSI camera not available; falling back to Kinect capture.")

        return self.grab_kinect_raw_frame()

    def grab_kinect_raw_frame(self) -> Optional[Image.Image]:
        try:
            import freenect
            data, _ = freenect.sync_get_video(0, freenect.VIDEO_RGB)
            if data is None:
                return None
            img_array = data.copy()
            self.kinect_active = True
            return Image.fromarray(img_array, mode="RGB")
        except Exception as e:
            logger.error(f"Kinect raw capture error: {e}")
            return None

    def capture_kinect_rgb_frame(self) -> Optional[Tuple[Image.Image, bytes]]:
        pil_img = self.grab_kinect_raw_frame()
        if pil_img is None:
            return None
        return pil_img, self.encode_incident_image(pil_img)

    def capture_cv2_frame(self, cap) -> Optional[Tuple[Image.Image, bytes]]:
        pil_img = self.grab_raw_frame(cap)
        if pil_img is None:
            return None
        return pil_img, self.encode_incident_image(pil_img)

    def stop(self):
        self.running = False
        self.location_corrector.stop()
        self.gps.stop()
        self.sync_service.stop()
        if self.imu:
            self.imu.close()
        if self.pi_camera is not None:
            self.pi_camera.stop()
            self.pi_camera = None
        if self.kinect_active:
            try:
                import freenect
                freenect.sync_stop()
                self.kinect_active = False
            except Exception:
                pass
        logger.info("Edge pipeline stopped.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Edge Litter Detection Controller")
    parser.add_argument("--model", type=str, default="models/trash_classifier_384.onnx")
    parser.add_argument("--data-dir", type=str, default=os.environ.get("TRASH_DATA_DIR", "/var/trash_data"))
    parser.add_argument("--threshold", type=float, default=0.50)
    parser.add_argument("--lookahead", "--look-ahead", type=float, default=3.0, help="Forward camera lookahead offset distance in meters")
    parser.add_argument("--min-sharpness", "--sharpness", type=float, default=35.0, help="Minimum Laplacian variance for blur rejection")
    parser.add_argument("--no-quality-check", action="store_true", help="Disable camera quality assessment")
    parser.add_argument("--stationary-debounce", type=float, default=2.0, help="Seconds of no movement before device is considered stationary")
    parser.add_argument("--max-stationary-captures", type=int, default=1, help="Maximum number of duplicate captures allowed while stationary (default 1)")
    parser.add_argument("--no-stationary-suppression", action="store_true", help="Disable stationary duplicate suppression")
    parser.add_argument("--imu-motion-threshold", type=float, default=0.08, help="MPU-6050 dynamic motion threshold in g (default 0.08g to ignore engine idle vibration)")
    parser.add_argument("--min-distance", type=float, default=20.0, help="Minimum GPS distance in meters between saved incidents (0 disables spatial dedup)")
    parser.add_argument("--dedup-window", type=float, default=1800.0, help="Time window in seconds for spatial deduplication (default 1800 = 30 min)")
    parser.add_argument("--visual-dedup-threshold", type=int, default=14, help="Max 64-bit dHash Hamming distance treated as duplicate scene (-1 disables)")
    parser.add_argument("--require-gps-fix", action="store_true", help="Skip saving detections when no valid GPS fix is available")
    parser.add_argument("--allow-mock-classifier", action="store_true", help="Allow mock 0.88 fallback if ONNX model fails to load (testing only)")
    parser.add_argument("--camera-source", type=str, choices=["auto", "picam", "opencv", "kinect"], default="auto", help="Camera backend: auto (prefers Pi CSI camera), picam (OV5647/libcamera), opencv, or kinect")
    parser.add_argument("--camera", type=int, default=None, help="OpenCV VideoCapture device index (selects opencv source)")
    parser.add_argument("--width", type=int, default=1296, help="Pi CSI camera capture width (default 1296 for full-FOV OV5647 binned mode)")
    parser.add_argument("--height", type=int, default=972, help="Pi CSI camera capture height (default 972 for full-FOV OV5647 binned mode)")
    parser.add_argument("--hflip", action="store_true", help="Flip Pi CSI camera image horizontally")
    parser.add_argument("--vflip", action="store_true", help="Flip Pi CSI camera image vertically")
    parser.add_argument("--interval", type=float, default=2.0)
    parser.add_argument("--test-image", type=str, default=None)
    parser.add_argument("--capture-once", action="store_true")
    args = parser.parse_args()

    effective_source = args.camera_source
    if args.camera is not None and effective_source == "auto":
        effective_source = "opencv"

    stop_event = threading.Event()

    def _handle_shutdown(signum, _frame):
        logger.info(f"Received signal {signum}; shutting down edge pipeline gracefully...")
        stop_event.set()

    signal.signal(signal.SIGTERM, _handle_shutdown)
    signal.signal(signal.SIGINT, _handle_shutdown)

    controller = EdgeMasterController(
        model_path=args.model,
        data_dir=args.data_dir,
        threshold=args.threshold,
        lookahead_meters=args.lookahead,
        min_sharpness=args.min_sharpness,
        check_quality=not args.no_quality_check,
        stationary_debounce_sec=args.stationary_debounce,
        max_stationary_captures=args.max_stationary_captures,
        suppress_stationary_duplicates=not args.no_stationary_suppression,
        imu_motion_threshold_g=args.imu_motion_threshold,
        min_distance_meters=args.min_distance,
        spatial_dedup_window_sec=args.dedup_window,
        visual_dedup_max_hamming=args.visual_dedup_threshold,
        require_gps_fix=args.require_gps_fix,
        allow_mock_classifier=args.allow_mock_classifier,
        camera_source=effective_source,
        camera_width=args.width,
        camera_height=args.height,
        camera_hflip=args.hflip,
        camera_vflip=args.vflip
    )
    controller.start()

    cap = None
    if effective_source == "opencv":
        import cv2
        cam_idx = args.camera if args.camera is not None else 0
        cap = cv2.VideoCapture(cam_idx)
        if not cap.isOpened():
            logger.error(f"Cannot open camera device {cam_idx}")
            controller.stop()
            sys.exit(1)

    try:
        if args.test_image and os.path.exists(args.test_image):
            logger.info(f"Evaluating test image: {args.test_image}")
            pil_img = Image.open(args.test_image)
            res = controller.evaluate_frame(pil_img)
            stop_event.wait(3)
        elif args.capture_once:
            logger.info(f"Grabbing single raw frame from camera (source={effective_source})...")
            t_cap = time.time()
            raw_frame = controller.grab_raw_frame(cap)
            if raw_frame:
                controller.evaluate_frame(raw_frame, capture_time=t_cap)
                stop_event.wait(3)
            else:
                logger.error("Failed to grab raw frame from camera.")
                sys.exit(1)
        else:
            logger.info(
                f"Continuous camera detection active (source={effective_source}, "
                f"interval={args.interval}s). Send SIGINT/SIGTERM to terminate."
            )
            while not stop_event.is_set():
                t_cap = time.time()
                raw_frame = controller.grab_raw_frame(cap)
                if raw_frame:
                    controller.evaluate_frame(raw_frame, capture_time=t_cap)
                else:
                    logger.warning("Failed to capture frame from camera; will retry.")
                stop_event.wait(args.interval)
    except KeyboardInterrupt:
        pass
    finally:
        if cap:
            cap.release()
        controller.stop()

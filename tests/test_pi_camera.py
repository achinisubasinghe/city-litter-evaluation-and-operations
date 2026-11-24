import io
import os
import shutil
import sys
import tempfile
import types
from unittest.mock import MagicMock, patch

from PIL import Image

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "edge"))

from pi_camera import PiCameraCapture
from main_pipeline import EdgeMasterController


def test_picamera2_backend_lifecycle():
    fake_img = Image.new("RGB", (1296, 972), color=(40, 120, 200))

    mock_picam_instance = MagicMock()
    mock_picam_instance.create_video_configuration.return_value = {"mock": "cfg"}
    mock_picam_instance.capture_image.return_value = fake_img

    mock_picam_cls = MagicMock(return_value=mock_picam_instance)
    mock_picam_cls.global_camera_info.return_value = [{"Model": "ov5647", "Num": 0}]

    fake_picamera2_mod = types.ModuleType("picamera2")
    fake_picamera2_mod.Picamera2 = mock_picam_cls

    fake_libcamera_mod = types.ModuleType("libcamera")
    fake_libcamera_mod.Transform = MagicMock(return_value="mock-transform")

    with patch.dict(sys.modules, {"picamera2": fake_picamera2_mod, "libcamera": fake_libcamera_mod}):
        cam = PiCameraCapture(width=1296, height=972, warmup_sec=0.0, hflip=True, vflip=False)
        assert cam.start() is True
        assert cam.backend == "picamera2"
        assert cam.camera_model == "ov5647"

        frame = cam.capture_frame()
        assert frame is not None
        assert frame.size == (1296, 972)
        assert frame.mode == "RGB"

        cam.stop()
        mock_picam_instance.stop.assert_called_once()
        mock_picam_instance.close.assert_called_once()


def test_rpicam_still_cli_fallback():
    buf = io.BytesIO()
    Image.new("RGB", (640, 480), color=(90, 90, 90)).save(buf, format="JPEG")
    jpeg_bytes = buf.getvalue()

    fake_res = MagicMock()
    fake_res.returncode = 0
    fake_res.stdout = jpeg_bytes
    fake_res.stderr = b""

    with patch.dict(sys.modules, {"picamera2": None}), \
         patch("pi_camera.shutil.which", side_effect=lambda name: "/usr/bin/rpicam-still" if name == "rpicam-still" else None), \
         patch("pi_camera.subprocess.run", return_value=fake_res) as mock_run:
        cam = PiCameraCapture(width=640, height=480, warmup_sec=0.0, vflip=True)
        assert cam.start() is True
        assert cam.backend == "rpicam-still"

        frame = cam.capture_frame()
        assert frame is not None
        assert frame.size == (640, 480)
        assert frame.mode == "RGB"

        called_cmd = mock_run.call_args[0][0]
        assert called_cmd[0] == "/usr/bin/rpicam-still"
        assert "--vflip" in called_cmd
        assert "--hflip" not in called_cmd

        cam.stop()


def test_controller_prefers_picam_in_auto_and_stops_cleanly():
    temp_dir = tempfile.mkdtemp()
    try:
        expected_frame = Image.new("RGB", (1296, 972), color=(100, 150, 200))
        mock_cam = MagicMock()
        mock_cam.start.return_value = True
        mock_cam.capture_frame.return_value = expected_frame

        with patch("main_pipeline.PiCameraCapture", return_value=mock_cam):
            controller = EdgeMasterController(
                data_dir=temp_dir,
                camera_source="auto",
                camera_width=1296,
                camera_height=972
            )
            frame = controller.grab_raw_frame()
            assert frame is expected_frame
            mock_cam.start.assert_called_once()
            mock_cam.capture_frame.assert_called_once()

            controller.stop()
            mock_cam.stop.assert_called_once()
            assert controller.pi_camera is None
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


def test_controller_picam_mode_does_not_fallback_to_kinect():
    temp_dir = tempfile.mkdtemp()
    try:
        mock_cam = MagicMock()
        mock_cam.start.return_value = False

        with patch("main_pipeline.PiCameraCapture", return_value=mock_cam):
            controller = EdgeMasterController(
                data_dir=temp_dir,
                camera_source="picam"
            )
            controller.grab_kinect_raw_frame = MagicMock()
            frame = controller.grab_raw_frame()
            assert frame is None
            controller.grab_kinect_raw_frame.assert_not_called()
            controller.stop()
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)

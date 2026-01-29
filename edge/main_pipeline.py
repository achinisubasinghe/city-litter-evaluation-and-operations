import argparse
import io
import logging
import os
import sys
import threading
import time
from typing import Optional, Tuple, Dict, Any, Union

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from gps_tracker import GPSReader
from mpu6050_sensor import MPU6050
from location_fusion import LocationFusionCorrector
from camera_quality import CameraQualityChecker
from offline_storage import OfflineStorage
from sync_service import ConvexSyncService

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
logger = logging.getLogger("EdgePipeline")


class DetectionResult(tuple):
    def __new__(
        cls,
        is_litter: bool,
        confidence: float,
        incident_id: Optional[str],
        quality: Optional[Dict[str, Any]] = None,
        suppressed: bool = False
    ):
        obj = super().__new__(cls, (is_litter, confidence, incident_id))
        obj.is_litter = is_litter
        obj.confidence = confidence
        obj.incident_id = incident_id
        obj.quality = quality or {}
        obj.suppressed = suppressed
        return obj


class LitterClassifier:
    def __init__(self, model_path: str):
        self.model_path = model_path
        self.backend = None
        self.session = None
        self.torch_model = None
        self.input_name = None
        self.output_name = None
        self._load_model()

    def _load_model(self):
        if not os.path.exists(self.model_path):
            alt_pt = os.path.join(os.path.dirname(self.model_path), "trash_classifier_384.pt")
            alt_onnx = os.path.join(os.path.dirname(self.model_path), "trash_classifier_384.onnx")
            project_onnx = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "models", "trash_classifier_384.onnx")
            if os.path.exists(alt_pt):
                self.model_path = alt_pt
            elif os.path.exists(alt_onnx):
                self.model_path = alt_onnx
            elif os.path.exists(project_onnx):
                self.model_path = project_onnx
            else:
                logger.warning(f"Model file not found at {self.model_path}. Using mock mode.")
                return

        if self.model_path.endswith(".pt"):
            try:
                import torch
                self.torch_model = torch.jit.load(self.model_path, map_location="cpu")
                self.torch_model.eval()
                self.backend = "torch"
                logger.info(f"Loaded TorchScript model: {self.model_path}")
                return
            except Exception as e:
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
        except Exception as e:
            logger.warning(f"Could not initialize ONNX Runtime: {e}. Falling back to mock classifier.")

    def preprocess_np(self, img_pil: Image.Image) -> np.ndarray:
        img = img_pil.convert('RGB').resize((384, 384))
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
        else:
            return 0.88

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
        suppress_stationary_duplicates: bool = True
    ):
        self.threshold = threshold
        self.lookahead_meters = lookahead_meters
        self.check_quality = check_quality
        self.stationary_debounce_sec = stationary_debounce_sec
        self.max_stationary_captures = max_stationary_captures
        self.suppress_stationary_duplicates = suppress_stationary_duplicates

        self.storage = OfflineStorage(data_dir=data_dir)
        self.gps = GPSReader()
        self.classifier = LitterClassifier(model_path)
        self.sync_service = ConvexSyncService(storage=self.storage)
        self.kinect_active = False

        self.imu = MPU6050(
            allow_mock=True,
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
                motion_data = self.imu.read_raw_data()
                is_moving = motion_data.get("is_moving", True)
                is_stationary = motion_data.get("is_stationary", not is_moving)
                stationary_duration = motion_data.get("stationary_duration_sec", 0.0)
            except Exception:
                pass

        gps_speed = None
        if self.gps and hasattr(self.gps, "last_fix"):
            gps_speed = self.gps.last_fix.get("speed_kmh")
        if gps_speed is not None and gps_speed > 2.5:
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
                    suppressed=True
                )

        logger.info(
            f"Frame: [LITTER DETECTED] (Confidence: {confidence * 100:.1f}%) -> "
            f"Capturing incident image & calculating corrected ground coordinates..."
        )

        captured_bytes = img_bytes if img_bytes is not None else self.encode_incident_image(img_pil, quality=90)

        corr = self.location_corrector.get_corrected_location(
            capture_time=t_capture,
            lookahead_distance=self.lookahead_meters
        )

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
            blur_score=quality.get("sharpness_score", 100.0)
        )

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

    def grab_raw_frame(self, cap=None) -> Optional[Image.Image]:
        if cap is not None:
            ret, frame = cap.read()
            if not ret:
                return None
            import cv2
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            return Image.fromarray(rgb_frame)
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
    parser.add_argument("--threshold", type=float, default=0.50)
    parser.add_argument("--lookahead", "--look-ahead", type=float, default=3.0, help="Forward camera lookahead offset distance in meters")
    parser.add_argument("--min-sharpness", "--sharpness", type=float, default=35.0, help="Minimum Laplacian variance for blur rejection")
    parser.add_argument("--no-quality-check", action="store_true", help="Disable camera quality assessment")
    parser.add_argument("--stationary-debounce", type=float, default=2.0, help="Seconds of no movement before device is considered stationary")
    parser.add_argument("--max-stationary-captures", type=int, default=1, help="Maximum number of duplicate captures allowed while stationary (default 1)")
    parser.add_argument("--no-stationary-suppression", action="store_true", help="Disable stationary duplicate suppression")
    parser.add_argument("--camera", type=int, default=None)
    parser.add_argument("--interval", type=float, default=2.0)
    parser.add_argument("--test-image", type=str, default=None)
    parser.add_argument("--capture-once", action="store_true")
    args = parser.parse_args()

    controller = EdgeMasterController(
        model_path=args.model,
        threshold=args.threshold,
        lookahead_meters=args.lookahead,
        min_sharpness=args.min_sharpness,
        check_quality=not args.no_quality_check,
        stationary_debounce_sec=args.stationary_debounce,
        max_stationary_captures=args.max_stationary_captures,
        suppress_stationary_duplicates=not args.no_stationary_suppression
    )
    controller.start()

    cap = None
    if args.camera is not None:
        import cv2
        cap = cv2.VideoCapture(args.camera)
        if not cap.isOpened():
            logger.error(f"Cannot open camera device {args.camera}")
            sys.exit(1)

    try:
        if args.test_image and os.path.exists(args.test_image):
            logger.info(f"Evaluating test image: {args.test_image}")
            pil_img = Image.open(args.test_image)
            res = controller.evaluate_frame(pil_img)
            time.sleep(3)
        elif args.capture_once:
            logger.info("Grabbing single raw frame from camera...")
            t_cap = time.time()
            raw_frame = controller.grab_raw_frame(cap)
            if raw_frame:
                controller.evaluate_frame(raw_frame, capture_time=t_cap)
                time.sleep(3)
            else:
                logger.error("Failed to grab raw frame from camera.")
        else:
            logger.info("Continuous camera detection active (evaluating quality & detecting litter). Press Ctrl+C to terminate.")
            while True:
                t_cap = time.time()
                raw_frame = controller.grab_raw_frame(cap)
                if raw_frame:
                    controller.evaluate_frame(raw_frame, capture_time=t_cap)
                time.sleep(args.interval)
    except KeyboardInterrupt:
        pass
    finally:
        if cap:
            cap.release()
        controller.stop()

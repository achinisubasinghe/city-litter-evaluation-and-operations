import os
import shutil
import sys
import tempfile
import threading
import time
from unittest.mock import MagicMock

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "edge"))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from location_fusion import haversine_meters
from main_pipeline import (
    EdgeMasterController,
    LitterClassifier,
    compute_dhash,
    dhash_hamming_distance,
)
from mpu6050_sensor import MPU6050
from offline_storage import OfflineStorage
from sync_service import ConvexSyncService


def _make_distinct_image(seed: int, size=(384, 384)) -> Image.Image:
    """Creates a structured synthetic scene with distinct large-scale brightness gradients."""
    rng = np.random.default_rng(seed)
    grid = rng.integers(20, 235, size=(8, 8, 3), dtype=np.uint8)
    img = Image.fromarray(grid, mode="RGB").resize(size, Image.Resampling.BILINEAR)
    arr = np.asarray(img, dtype=np.int16)
    noise = rng.integers(-10, 11, size=arr.shape)
    return Image.fromarray(np.clip(arr + noise, 0, 255).astype(np.uint8), mode="RGB")


def _make_controller(temp_dir: str, **kwargs) -> EdgeMasterController:
    defaults = dict(
        data_dir=temp_dir,
        threshold=0.50,
        check_quality=False,
        suppress_stationary_duplicates=True,
        min_distance_meters=20.0,
        spatial_dedup_window_sec=1800.0,
        visual_dedup_max_hamming=14,
        require_gps_fix=False,
    )
    defaults.update(kwargs)
    controller = EdgeMasterController(**defaults)
    controller.sync_service.check_connectivity = lambda: False
    controller.classifier.predict = lambda img: 0.85
    return controller


def test_classifier_fail_fast_when_model_missing():
    raised = False
    try:
        LitterClassifier("/nonexistent/path/missing_model.onnx", allow_mock=False)
    except RuntimeError as exc:
        raised = "Model file not found" in str(exc) or "Could not initialize" in str(exc)
    assert raised, "Expected RuntimeError when model path is missing and allow_mock=False"


def test_classifier_explicit_allow_mock():
    temp_dir = tempfile.mkdtemp()
    try:
        # Force missing path AND ensure fallback lookup fails by pointing to bad corrupt onnx file
        bad_onnx = os.path.join(temp_dir, "corrupt.onnx")
        with open(bad_onnx, "wb") as f:
            f.write(b"not a valid onnx model")

        raised = False
        try:
            LitterClassifier(bad_onnx, allow_mock=False)
        except RuntimeError as exc:
            raised = "Could not initialize ONNX Runtime" in str(exc)
        assert raised, "Expected RuntimeError when ONNX load fails and allow_mock=False"

        clf = LitterClassifier(bad_onnx, allow_mock=True)
        assert clf.backend is None
        assert clf.predict(Image.new("RGB", (64, 64), color=(100, 100, 100))) == 0.88
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


def test_spatial_geofence_deduplication_and_persistence():
    temp_dir = tempfile.mkdtemp()
    try:
        controller = _make_controller(
            temp_dir,
            min_distance_meters=20.0,
            visual_dedup_max_hamming=-1,  # isolate spatial check
            suppress_stationary_duplicates=False,
        )
        controller.gps.set_simulated_location(6.810100, 79.994900, speed_kmh=15.0, heading=0.0, has_fix=True)
        controller.location_corrector._check_and_sync_gps()

        img1 = _make_distinct_image(1)
        res1 = controller.evaluate_frame(img1)
        assert res1.is_litter is True
        assert res1.incident_id is not None

        # Move only ~5 meters North (well inside 20m geofence) -> MUST suppress
        controller.gps.set_simulated_location(6.810145, 79.994900, speed_kmh=15.0, heading=0.0, has_fix=True)
        controller.location_corrector._check_and_sync_gps()
        img2 = _make_distinct_image(2)
        res2 = controller.evaluate_frame(img2)
        assert res2.is_litter is False
        assert res2.suppressed is True
        assert res2.suppression_reason == "spatial_duplicate"
        assert res2.incident_id is None

        # Simulate service restart at same spot -> persisted SQLite geofence still suppresses
        controller2 = _make_controller(
            temp_dir,
            min_distance_meters=20.0,
            visual_dedup_max_hamming=-1,
            suppress_stationary_duplicates=False,
        )
        controller2.gps.set_simulated_location(6.810150, 79.994900, speed_kmh=15.0, heading=0.0, has_fix=True)
        controller2.location_corrector._check_and_sync_gps()
        res3 = controller2.evaluate_frame(_make_distinct_image(3))
        assert res3.is_litter is False
        assert res3.suppressed is True
        assert res3.suppression_reason == "spatial_duplicate"

        # Move ~35 meters North (outside 20m geofence) -> MUST capture
        controller2.gps.set_simulated_location(6.810420, 79.994900, speed_kmh=20.0, heading=0.0, has_fix=True)
        controller2.location_corrector._check_and_sync_gps()
        res4 = controller2.evaluate_frame(_make_distinct_image(4))
        assert res4.is_litter is True
        assert res4.incident_id is not None
        assert res4.suppressed is False
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


def test_visual_dhash_deduplication_and_persistence():
    temp_dir = tempfile.mkdtemp()
    try:
        controller = _make_controller(
            temp_dir,
            min_distance_meters=0.0,  # isolate visual dedup
            visual_dedup_max_hamming=14,
            suppress_stationary_duplicates=False,
        )

        base_img = _make_distinct_image(42)
        # Slightly shifted brightness/noise copy of the same scene
        arr = np.asarray(base_img, dtype=np.int16)
        rng = np.random.default_rng(99)
        near_same_img = Image.fromarray(
            np.clip(arr + 8 + rng.integers(-6, 7, size=arr.shape), 0, 255).astype(np.uint8),
            mode="RGB",
        )
        diff_img = _make_distinct_image(12345)

        assert dhash_hamming_distance(compute_dhash(base_img), compute_dhash(near_same_img)) <= 14
        assert dhash_hamming_distance(compute_dhash(base_img), compute_dhash(diff_img)) > 14

        res1 = controller.evaluate_frame(base_img)
        assert res1.is_litter is True
        assert res1.incident_id is not None

        # Near-identical scene -> visually suppressed
        res2 = controller.evaluate_frame(near_same_img)
        assert res2.is_litter is False
        assert res2.suppressed is True
        assert res2.suppression_reason == "visual_duplicate"

        # Restart controller: seeded visual hashes from SQLite still suppress duplicate
        controller2 = _make_controller(
            temp_dir,
            min_distance_meters=0.0,
            visual_dedup_max_hamming=14,
            suppress_stationary_duplicates=False,
        )
        res3 = controller2.evaluate_frame(near_same_img)
        assert res3.is_litter is False
        assert res3.suppressed is True
        assert res3.suppression_reason == "visual_duplicate"

        # Distinct scene -> allowed
        res4 = controller2.evaluate_frame(diff_img)
        assert res4.is_litter is True
        assert res4.incident_id is not None
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


def test_real_gps_zero_speed_overrides_imu_idle_vibration():
    """
    Reproduces the car-idle bug: GPS has a real fix at 0.0 km/h while the MPU-6050
    reports moving=True due to engine vibration. Controller must stay stationary.
    """
    temp_dir = tempfile.mkdtemp()
    try:
        controller = _make_controller(
            temp_dir,
            min_distance_meters=0.0,  # isolate stationary logic
            visual_dedup_max_hamming=-1,
            suppress_stationary_duplicates=True,
            max_stationary_captures=1,
        )

        # Simulate real non-mock GPS fix at 0.0 km/h
        with controller.gps._lock:
            controller.gps.state["latitude"] = 6.81012
            controller.gps.state["longitude"] = 79.99490
            controller.gps.state["speed_kmh"] = 0.0
            controller.gps.state["heading"] = 90.0
            controller.gps.state["has_fix"] = True
            controller.gps.state["is_mock"] = False
            controller.gps.state["last_updated"] = time.time()
        controller.location_corrector._check_and_sync_gps()

        # Simulate idling car engine vibrating the IMU so IMU claims is_moving=True
        controller.imu.set_simulated_motion(is_moving=True, forward_accel_g=0.04)

        img1 = _make_distinct_image(10)
        res1 = controller.evaluate_frame(img1)
        assert res1.is_litter is True
        assert controller.was_stationary is True
        assert controller.stationary_captures_count == 1

        # Second frame while parked with engine idling -> MUST be suppressed
        img2 = _make_distinct_image(11)
        res2 = controller.evaluate_frame(img2)
        assert res2.is_litter is False
        assert res2.suppressed is True
        assert res2.suppression_reason == "stationary"

        # Now car actually drives away at 18 km/h -> resets stationary lock and captures
        with controller.gps._lock:
            controller.gps.state["speed_kmh"] = 18.0
            controller.gps.state["last_updated"] = time.time()
        res3 = controller.evaluate_frame(_make_distinct_image(12))
        assert res3.is_litter is True
        assert controller.was_stationary is False
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


def test_require_gps_fix_suppresses_fallback_coordinates():
    temp_dir = tempfile.mkdtemp()
    try:
        controller = _make_controller(
            temp_dir,
            require_gps_fix=True,
            suppress_stationary_duplicates=False,
        )
        # Before GPS fix, LocationFusionCorrector returns default_fallback / has_gps_fix=False
        res_nofix = controller.evaluate_frame(_make_distinct_image(20))
        assert res_nofix.is_litter is False
        assert res_nofix.suppressed is True
        assert res_nofix.suppression_reason == "no_gps_fix"
        assert controller.storage.get_stats()["total"] == 0

        # Once a valid GPS fix arrives -> capture succeeds
        controller.gps.set_simulated_location(6.81012, 79.99490, speed_kmh=12.0, heading=45.0, has_fix=True)
        controller.location_corrector._check_and_sync_gps()
        res_fix = controller.evaluate_frame(_make_distinct_image(21))
        assert res_fix.is_litter is True
        assert res_fix.incident_id is not None
        assert controller.storage.get_stats()["total"] == 1
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


def test_mpu6050_default_threshold_and_thread_safety():
    sensor = MPU6050(allow_mock=True)
    assert sensor.motion_threshold_g >= 0.08

    errors = []

    def reader_worker():
        try:
            for _ in range(50):
                d = sensor.read_raw_data()
                assert "is_moving" in d
                cached = sensor.get_latest_reading()
                assert "dynamic_motion" in cached
        except Exception as e:
            errors.append(e)

    threads = [threading.Thread(target=reader_worker) for _ in range(4)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert errors == []


def test_sync_service_handles_server_deduplicated_response():
    temp_dir = tempfile.mkdtemp()
    try:
        storage = OfflineStorage(data_dir=temp_dir)
        inc_id = storage.save_incident(
            image_bytes=b"fakejpeg",
            latitude=6.81012,
            longitude=79.99490,
            confidence=0.81,
            has_gps_fix=True,
            visual_hash="0123456789abcdef",
        )
        svc = ConvexSyncService(convex_url="https://example.invalid", storage=storage)
        svc._get_upload_url = MagicMock(return_value="https://example.invalid/upload")
        svc._upload_image_bytes = MagicMock(return_value="storage_123")
        svc._call_mutation = MagicMock(
            return_value={"reportId": "existing_rep_1", "status": "deduplicated", "distanceMeters": 4.2}
        )

        synced = svc.sync_batch(batch_size=5)
        assert synced == 1
        assert storage.get_stats()["pending"] == 0
        assert storage.get_stats()["synced"] == 1
        assert inc_id is not None
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


def test_haversine_accuracy():
    # ~111.32 meters per 0.001 degree latitude
    dist = haversine_meters(6.8100, 79.9949, 6.8110, 79.9949)
    assert 110.0 < dist < 113.0


if __name__ == "__main__":
    for fn in [
        test_classifier_fail_fast_when_model_missing,
        test_classifier_explicit_allow_mock,
        test_spatial_geofence_deduplication_and_persistence,
        test_visual_dhash_deduplication_and_persistence,
        test_real_gps_zero_speed_overrides_imu_idle_vibration,
        test_require_gps_fix_suppresses_fallback_coordinates,
        test_mpu6050_default_threshold_and_thread_safety,
        test_sync_service_handles_server_deduplicated_response,
        test_haversine_accuracy,
    ]:
        fn()
        print(f"PASS: {fn.__name__}")
    print("ALL deduplication unit tests passed successfully!")

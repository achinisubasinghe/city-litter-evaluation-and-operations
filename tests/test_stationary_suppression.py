import os
import shutil
import tempfile
import time
from PIL import Image

import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "edge"))

from mpu6050_sensor import MPU6050
from main_pipeline import EdgeMasterController, DetectionResult


def test_mpu6050_motion_and_stillness_detection():
    sensor = MPU6050(allow_mock=True, stationary_debounce_sec=0.2)

    sensor.set_simulated_motion(is_moving=False)
    data_still = sensor.read_raw_data()
    assert data_still["is_moving"] is False
    assert data_still["is_stationary"] is True
    assert sensor.is_stationary() is True
    assert sensor.is_moving() is False

    sensor.set_simulated_motion(is_moving=True, forward_accel_g=0.25)
    data_moving = sensor.read_raw_data()
    assert data_moving["is_moving"] is True
    assert data_moving["is_stationary"] is False
    assert sensor.is_moving() is True
    assert sensor.is_stationary() is False

    sensor.set_simulated_motion(is_moving=False)
    time.sleep(0.25)
    data_restored = sensor.read_raw_data()
    assert data_restored["is_moving"] is False
    assert data_restored["is_stationary"] is True


def test_stationary_capture_suppression_workflow():
    temp_dir = tempfile.mkdtemp()
    try:
        controller = EdgeMasterController(
            data_dir=temp_dir,
            threshold=0.50,
            check_quality=False,
            stationary_debounce_sec=0.1,
            max_stationary_captures=1,
            suppress_stationary_duplicates=True,
            min_distance_meters=0.0,
            visual_dedup_max_hamming=-1
        )
        controller.sync_service.check_connectivity = lambda: False

        controller.classifier.predict = lambda img: 0.95

        test_img = Image.new("RGB", (384, 384), color=(120, 120, 120))

        controller.imu.set_simulated_motion(is_moving=False)
        time.sleep(0.15)

        # 1. First frame while stationary -> MUST capture
        res1 = controller.evaluate_frame(test_img)
        assert res1.is_litter is True
        assert res1.incident_id is not None
        assert res1.suppressed is False
        assert controller.stationary_captures_count == 1
        assert controller.was_stationary is True

        # 2. Second frame while stationary in same place -> MUST be suppressed!
        res2 = controller.evaluate_frame(test_img)
        assert res2.is_litter is False
        assert res2.incident_id is None
        assert res2.suppressed is True
        assert controller.stationary_captures_count == 1

        # 3. Third frame still stationary -> MUST remain suppressed!
        res3 = controller.evaluate_frame(test_img)
        assert res3.is_litter is False
        assert res3.incident_id is None
        assert res3.suppressed is True

        # 4. Device moves! Accelerometer signals movement
        controller.imu.set_simulated_motion(is_moving=True, forward_accel_g=0.2)
        res_moving = controller.evaluate_frame(test_img)
        assert res_moving.is_litter is True
        assert res_moving.incident_id is not None
        assert res_moving.suppressed is False
        assert controller.was_stationary is False
        assert controller.stationary_captures_count == 0

        # 5. Device stops again at new location
        controller.imu.set_simulated_motion(is_moving=False)
        time.sleep(0.15)

        # 6. First frame at new stationary spot -> MUST capture once
        res_new_spot1 = controller.evaluate_frame(test_img)
        assert res_new_spot1.is_litter is True
        assert res_new_spot1.incident_id is not None
        assert res_new_spot1.suppressed is False

        # 7. Next frame at this spot -> suppressed again
        res_new_spot2 = controller.evaluate_frame(test_img)
        assert res_new_spot2.is_litter is False
        assert res_new_spot2.suppressed is True

    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


def test_disabled_stationary_suppression():
    temp_dir = tempfile.mkdtemp()
    try:
        controller = EdgeMasterController(
            data_dir=temp_dir,
            threshold=0.50,
            check_quality=False,
            stationary_debounce_sec=0.1,
            max_stationary_captures=1,
            suppress_stationary_duplicates=False,
            min_distance_meters=0.0,
            visual_dedup_max_hamming=-1
        )
        controller.sync_service.check_connectivity = lambda: False

        controller.classifier.predict = lambda img: 0.95
        test_img = Image.new("RGB", (384, 384), color=(120, 120, 120))
        controller.imu.set_simulated_motion(is_moving=False)
        time.sleep(0.15)

        r1 = controller.evaluate_frame(test_img)
        r2 = controller.evaluate_frame(test_img)
        assert r1.is_litter is True
        assert r2.is_litter is True
        assert r1.incident_id is not None
        assert r2.incident_id is not None
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


if __name__ == "__main__":
    print("Testing MPU6050 motion and stillness detection...")
    test_mpu6050_motion_and_stillness_detection()
    print("PASS: test_mpu6050_motion_and_stillness_detection")

    print("Testing stationary capture suppression workflow...")
    test_stationary_capture_suppression_workflow()
    print("PASS: test_stationary_capture_suppression_workflow")

    print("Testing disabled stationary suppression...")
    test_disabled_stationary_suppression()
    print("PASS: test_disabled_stationary_suppression")

    print("ALL stationary suppression unit tests passed successfully!")

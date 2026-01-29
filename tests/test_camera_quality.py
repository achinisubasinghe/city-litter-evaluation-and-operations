#!/usr/bin/env python3
"""
Unit tests for Camera Quality Assessment and Conditional Image Capture.
"""

import io
import os
import shutil
import tempfile
import numpy as np
try:
    import pytest
except ImportError:
    pytest = None
from PIL import Image, ImageFilter

import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "edge"))

from camera_quality import CameraQualityChecker
from main_pipeline import EdgeMasterController, DetectionResult


def test_sharp_vs_blurry_image_quality():
    checker = CameraQualityChecker(min_sharpness=50.0)

    # 1. Create a sharp high-contrast grid pattern
    arr = np.zeros((384, 384), dtype=np.uint8)
    arr[::2, ::2] = 180
    arr[1::2, 1::2] = 60
    arr[::2, 1::2] = 80
    arr[1::2, ::2] = 160
    sharp_img = Image.fromarray(arr)

    sharp_report = checker.evaluate_quality(sharp_img)
    assert sharp_report["is_acceptable"] is True
    assert sharp_report["is_blurry"] is False
    assert sharp_report["sharpness_score"] > 100.0
    assert sharp_report["quality_score"] > 0.70

    # 2. Gaussian blur the image severely
    blurry_img = sharp_img.filter(ImageFilter.GaussianBlur(radius=8))
    blurry_report = checker.evaluate_quality(blurry_img)
    assert blurry_report["is_acceptable"] is False
    assert blurry_report["is_blurry"] is True
    assert "frame_blurry" in blurry_report["issues"]
    assert blurry_report["sharpness_score"] < 10.0


def test_exposure_detection():
    checker = CameraQualityChecker(min_brightness=30.0, max_brightness=230.0)

    # 1. Severely underexposed / dark frame (e.g. nighttime or covered lens)
    dark_img = Image.new("RGB", (200, 200), color=(10, 10, 10))
    dark_report = checker.evaluate_quality(dark_img)
    assert dark_report["is_acceptable"] is False
    assert dark_report["is_underexposed"] is True
    assert "camera_underexposed" in dark_report["issues"]

    # 2. Severely overexposed / blown-out frame (e.g. headlight glare / sunlight)
    bright_img = Image.new("RGB", (200, 200), color=(250, 250, 250))
    bright_report = checker.evaluate_quality(bright_img)
    assert bright_report["is_acceptable"] is False
    assert bright_report["is_overexposed"] is True
    assert "camera_overexposed" in bright_report["issues"]


def test_vibration_rejection():
    checker = CameraQualityChecker(max_vibration_g=0.35)
    normal_img = Image.fromarray(np.random.randint(50, 200, (200, 200, 3), dtype=np.uint8))

    # Smooth motion (vibration 0.05g) -> accepted
    report_smooth = checker.evaluate_quality(normal_img, imu_motion_data={"dynamic_motion": 0.05})
    assert report_smooth["is_vibrating"] is False
    assert "excessive_vehicle_vibration" not in report_smooth["issues"]

    # Severe pothole / truck rumble (vibration 0.55g) -> rejected
    report_bumpy = checker.evaluate_quality(normal_img, imu_motion_data={"dynamic_motion": 0.55})
    assert report_bumpy["is_acceptable"] is False
    assert report_bumpy["is_vibrating"] is True
    assert "excessive_vehicle_vibration" in report_bumpy["issues"]


def test_capture_image_only_when_litter_detected():
    temp_dir = tempfile.mkdtemp()
    try:
        controller = EdgeMasterController(
            model_path="models/trash_classifier_384.onnx",
            data_dir=temp_dir,
            threshold=0.50,
            check_quality=True
        )
        controller.start()

        # 1. Clean test frame: high threshold (0.99) ensures no litter is detected
        controller.threshold = 0.99
        clean_img = Image.fromarray(np.random.randint(60, 180, (384, 384, 3), dtype=np.uint8))
        res_clean = controller.evaluate_frame(clean_img)

        assert res_clean.is_litter is False
        assert res_clean.incident_id is None
        # Verify no images were saved to disk for clean frame
        images_dir = os.path.join(temp_dir, "images")
        saved_files = os.listdir(images_dir) if os.path.exists(images_dir) else []
        assert len(saved_files) == 0, f"Expected 0 images for clean frame, found: {saved_files}"

        # 2. Litter test frame: low threshold (0.01) triggers litter detection
        controller.threshold = 0.01
        litter_img = Image.fromarray(np.random.randint(60, 180, (384, 384, 3), dtype=np.uint8))
        res_litter = controller.evaluate_frame(litter_img)

        assert res_litter.is_litter is True
        assert res_litter.incident_id is not None

        # Verify incident image was captured and saved to disk
        saved_files = os.listdir(images_dir)
        assert len(saved_files) == 1
        assert saved_files[0].endswith(".jpg")

        # Verify quality metrics stored in database
        with controller.storage._get_connection() as conn:
            row = conn.execute("SELECT * FROM local_reports WHERE id = ?", (res_litter.incident_id,)).fetchone()
            assert row is not None
            assert row["quality_score"] > 0.0
            assert row["blur_score"] > 0.0

        controller.stop()
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


def test_blurry_frame_is_rejected_without_capture():
    temp_dir = tempfile.mkdtemp()
    try:
        controller = EdgeMasterController(
            model_path="models/trash_classifier_384.onnx",
            data_dir=temp_dir,
            threshold=0.01, # Even with low threshold
            min_sharpness=80.0,
            check_quality=True
        )
        controller.start()

        # Completely smooth/blurry image
        blurry_img = Image.new("RGB", (384, 384), color=(128, 128, 128))
        res = controller.evaluate_frame(blurry_img)

        # Should be rejected by camera quality check
        assert res.is_litter is False
        assert res.incident_id is None
        assert res.quality["is_acceptable"] is False
        assert res.quality["is_blurry"] is True

        # No images written to disk
        images_dir = os.path.join(temp_dir, "images")
        saved_files = os.listdir(images_dir) if os.path.exists(images_dir) else []
        assert len(saved_files) == 0

        controller.stop()
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


if __name__ == "__main__":
    if pytest:
        pytest.main(["-v", __file__])
    else:
        test_sharp_vs_blurry_image_quality()
        test_exposure_detection()
        test_vibration_rejection()
        test_capture_image_only_when_litter_detected()
        test_blurry_frame_is_rejected_without_capture()
        print("All camera quality tests passed successfully!")

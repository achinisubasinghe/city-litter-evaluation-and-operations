import logging
import math
from typing import Dict, Any, Optional, Tuple, Union

import numpy as np
from PIL import Image

logger = logging.getLogger("CameraQuality")


class CameraQualityChecker:
    """
    Evaluates camera frame optical and sensor quality for roadside edge detection.
    
    Checks:
    1. Sharpness / Blur: Laplacian variance (rejects motion-blurred / out-of-focus frames).
    2. Illumination / Exposure: Mean pixel intensity (rejects underexposed / overexposed frames).
    3. Dynamic Contrast: Pixel standard deviation (detects washed out or lens-occluded frames).
    4. Vehicle Vibration: IMU dynamic motion magnitude (detects pothole / engine shock).
    """

    def __init__(
        self,
        min_sharpness: float = 40.0,
        min_brightness: float = 30.0,
        max_brightness: float = 230.0,
        min_contrast: float = 18.0,
        max_vibration_g: float = 0.35,
        min_quality_score: float = 0.50
    ):
        self.min_sharpness = min_sharpness
        self.min_brightness = min_brightness
        self.max_brightness = max_brightness
        self.min_contrast = min_contrast
        self.max_vibration_g = max_vibration_g
        self.min_quality_score = min_quality_score

    @staticmethod
    def _to_grayscale_array(img: Union[Image.Image, np.ndarray]) -> np.ndarray:
        if isinstance(img, Image.Image):
            gray_img = img.convert('L')
            return np.array(gray_img, dtype=np.float32)
        elif isinstance(img, np.ndarray):
            if img.ndim == 3:
                # RGB or BGR to Grayscale using standard ITU-R 601-2 luma transform
                return (0.299 * img[:, :, 0] + 0.587 * img[:, :, 1] + 0.114 * img[:, :, 2]).astype(np.float32)
            return img.astype(np.float32)
        else:
            raise TypeError(f"Unsupported image type: {type(img)}")

    @staticmethod
    def calculate_sharpness(gray_arr: np.ndarray) -> float:
        """
        Calculates Laplacian variance as a focus / blur measure.
        Higher values indicate sharp edges; low values (< 30-50) indicate motion or defocus blur.
        """
        try:
            import cv2
            laplacian = cv2.Laplacian(gray_arr, cv2.CV_64F)
            return float(laplacian.var())
        except (ImportError, Exception):
            # Fast vectorized discrete 2D Laplacian slice convolution in NumPy:
            # Kernel: [[0, 1, 0], [1, -4, 1], [0, 1, 0]]
            if gray_arr.shape[0] < 3 or gray_arr.shape[1] < 3:
                return 0.0
            lap = (
                gray_arr[:-2, 1:-1] +
                gray_arr[2:, 1:-1] +
                gray_arr[1:-1, :-2] +
                gray_arr[1:-1, 2:] -
                4.0 * gray_arr[1:-1, 1:-1]
            )
            return float(np.var(lap))

    def evaluate_quality(
        self,
        img: Union[Image.Image, np.ndarray],
        imu_motion_data: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Assesses overall frame optical quality and returns an actionable report.
        """
        gray_arr = self._to_grayscale_array(img)

        # 1. Optical metrics
        sharpness = self.calculate_sharpness(gray_arr)
        brightness = float(np.mean(gray_arr))
        contrast = float(np.std(gray_arr))

        # 2. Vibration metrics from IMU
        vibration_g = 0.0
        if imu_motion_data:
            vibration_g = float(imu_motion_data.get("dynamic_motion", 0.0))

        # 3. Identify optical & environmental quality issues
        issues = []
        is_blurry = sharpness < self.min_sharpness
        if is_blurry:
            issues.append("frame_blurry")

        is_underexposed = brightness < self.min_brightness
        is_overexposed = brightness > self.max_brightness
        if is_underexposed:
            issues.append("camera_underexposed")
        elif is_overexposed:
            issues.append("camera_overexposed")

        is_low_contrast = contrast < self.min_contrast
        if is_low_contrast:
            issues.append("low_contrast")

        is_vibrating = vibration_g > self.max_vibration_g
        if is_vibrating:
            issues.append("excessive_vehicle_vibration")

        # 4. Normalized sub-scores (0.0 to 1.0)
        # Sharpness score: normalized sigmoid-like transition around min_sharpness
        sharpness_norm = min(1.0, max(0.0, sharpness / (self.min_sharpness * 2.5)))
        
        # Exposure score: optimal centered around 128
        if 60.0 <= brightness <= 190.0:
            exposure_norm = 1.0
        elif brightness < 60.0:
            exposure_norm = max(0.0, brightness / 60.0)
        else:
            exposure_norm = max(0.0, (255.0 - brightness) / 65.0)

        # Contrast score
        contrast_norm = min(1.0, max(0.0, contrast / 45.0))

        # Vibration score: 1.0 when smooth, drops towards 0.0 during severe bumps
        vibration_norm = max(0.0, 1.0 - (vibration_g / (self.max_vibration_g * 1.5)))

        # Composite quality score (0.0 to 1.0)
        composite_score = round(
            (0.40 * sharpness_norm) +
            (0.30 * exposure_norm) +
            (0.20 * contrast_norm) +
            (0.10 * vibration_norm),
            3
        )

        # Overall acceptability decision
        is_acceptable = (
            (not is_blurry) and
            (not is_underexposed) and
            (not is_overexposed) and
            (not is_vibrating) and
            (composite_score >= self.min_quality_score)
        )

        return {
            "is_acceptable": is_acceptable,
            "quality_score": composite_score,
            "sharpness_score": round(sharpness, 1),
            "brightness_score": round(brightness, 1),
            "contrast_score": round(contrast, 1),
            "vibration_g": round(vibration_g, 3),
            "is_blurry": is_blurry,
            "is_underexposed": is_underexposed,
            "is_overexposed": is_overexposed,
            "is_vibrating": is_vibrating,
            "issues": issues,
            "recommendation": "acceptable" if is_acceptable else f"discard_{issues[0]}" if issues else "discard_low_score"
        }


if __name__ == "__main__":
    checker = CameraQualityChecker()

    # Test clean sharp synthetic image
    arr_sharp = np.random.randint(0, 255, (384, 384), dtype=np.uint8)
    report_sharp = checker.evaluate_quality(arr_sharp)
    print("Sharp Test:", report_sharp)

    # Test uniform dark blurry image
    arr_dark = np.ones((384, 384), dtype=np.uint8) * 15
    report_dark = checker.evaluate_quality(arr_dark)
    print("Dark/Blurry Test:", report_dark)

#!/usr/bin/env python3
"""
Unit and integration tests for GPS + Accelerometer location correction system.
"""

import math
import os
import shutil
import tempfile
import time
try:
    import pytest
except ImportError:
    pytest = None

from PIL import Image

import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "edge"))

from gps_tracker import GPSReader, parse_nmea_coord
from mpu6050_sensor import MPU6050
from location_fusion import LocationFusionCorrector, EARTH_RADIUS_METERS
from offline_storage import OfflineStorage
from main_pipeline import EdgeMasterController


def test_parse_nmea_coordinates():
    # Example NMEA: 0645.7749 N -> 6 deg + 45.7749/60 min = 6.762915
    lat = parse_nmea_coord("0645.7749", "N")
    assert lat is not None
    assert abs(lat - 6.762915) < 1e-4

    # Example NMEA: 08000.2800 E -> 80 deg + 0.2800/60 min = 80.004667
    lon = parse_nmea_coord("08000.2800", "E")
    assert lon is not None
    assert abs(lon - 80.004667) < 1e-4

    # Southern / Western hemispheres should be negative
    lat_s = parse_nmea_coord("0645.7749", "S")
    assert lat_s is not None and lat_s < 0

    lon_w = parse_nmea_coord("08000.2800", "W")
    assert lon_w is not None and lon_w < 0


def test_geodesic_projection_cardinals():
    base_lat = 6.762915
    base_lon = 80.004667
    dist_m = 100.0

    # 1. Project North (heading = 0)
    lat_n, lon_n = LocationFusionCorrector.project_geodesic(base_lat, base_lon, dist_m, 0.0)
    assert lat_n > base_lat
    assert abs(lon_n - base_lon) < 1e-6
    expected_lat_shift = (dist_m / EARTH_RADIUS_METERS) * (180.0 / math.pi)
    assert abs((lat_n - base_lat) - expected_lat_shift) < 1e-7

    # 2. Project South (heading = 180)
    lat_s, lon_s = LocationFusionCorrector.project_geodesic(base_lat, base_lon, dist_m, 180.0)
    assert lat_s < base_lat
    assert abs(lon_s - base_lon) < 1e-6

    # 3. Project East (heading = 90)
    lat_e, lon_e = LocationFusionCorrector.project_geodesic(base_lat, base_lon, dist_m, 90.0)
    assert abs(lat_e - base_lat) < 1e-6
    assert lon_e > base_lon

    # 4. Project West (heading = 270)
    lat_w, lon_w = LocationFusionCorrector.project_geodesic(base_lat, base_lon, dist_m, 270.0)
    assert abs(lat_w - base_lat) < 1e-6
    assert lon_w < base_lon


def test_stationary_location_correction():
    gps = GPSReader()
    imu = MPU6050(allow_mock=True)
    corrector = LocationFusionCorrector(
        gps_reader=gps,
        imu_sensor=imu,
        lookahead_distance_meters=3.0
    )

    base_lat = 6.762915
    base_lon = 80.004667
    gps.set_simulated_location(base_lat, base_lon, speed_kmh=0.0, heading=0.0, has_fix=True)
    imu.set_simulated_motion(is_moving=False)

    gps.start()
    corrector.start()
    time.sleep(0.2)

    res = corrector.get_corrected_location()
    corrector.stop()
    gps.stop()

    assert res["is_corrected"] is True
    assert res["raw_latitude"] == base_lat
    assert res["raw_longitude"] == base_lon
    # Stationary lookahead: offset should equal camera lookahead (3.0m)
    assert abs(res["total_offset_meters"] - 3.0) < 0.2
    assert res["latitude"] > base_lat  # shifted north along heading 0°


def test_moving_vehicle_latency_and_lookahead():
    gps = GPSReader()
    imu = MPU6050(allow_mock=True)
    corrector = LocationFusionCorrector(
        gps_reader=gps,
        imu_sensor=imu,
        lookahead_distance_meters=3.0
    )

    base_lat = 6.762915
    base_lon = 80.004667
    # Vehicle moving at 36 km/h = 10 m/s heading 90° East
    gps.set_simulated_location(base_lat, base_lon, speed_kmh=36.0, heading=90.0, has_fix=True)
    imu.set_simulated_motion(is_moving=True, forward_accel_g=0.0, yaw_rate_degs=0.0)

    gps.start()
    corrector.start()
    time.sleep(0.3)

    # Frame captured 0.5s after the GPS fix (10 m/s * 0.5s = 5m travel)
    anchor_time = corrector._anchor_time
    capture_time = anchor_time + 0.5

    res = corrector.get_corrected_location(capture_time=capture_time, lookahead_distance=4.0)
    corrector.stop()
    gps.stop()

    assert res["is_corrected"] is True
    assert res["heading_deg"] == 90.0
    # Travel displacement ~ 5m, lookahead = 4m -> total offset ~ 9m
    assert res["total_offset_meters"] >= 4.0
    assert res["longitude"] > base_lon  # Shifted east


def test_dead_reckoning_during_gps_loss():
    gps = GPSReader()
    imu = MPU6050(allow_mock=True)
    corrector = LocationFusionCorrector(
        gps_reader=gps,
        imu_sensor=imu,
        lookahead_distance_meters=2.5,
        enable_dead_reckoning=True
    )

    base_lat = 6.762915
    base_lon = 80.004667
    gps.set_simulated_location(base_lat, base_lon, speed_kmh=20.0, heading=0.0, has_fix=True)
    imu.set_simulated_motion(is_moving=True, forward_accel_g=0.0, yaw_rate_degs=0.0)

    gps.start()
    corrector.start()
    time.sleep(0.2)

    # Now simulate GPS outage (loss of satellites / tunnel / bridge)
    gps.set_simulated_location(base_lat, base_lon, speed_kmh=0.0, heading=0.0, has_fix=False, satellites=0)
    time.sleep(0.2)

    # Simulate 5 seconds without GPS fix
    anchor_time = corrector._anchor_time
    capture_time = anchor_time + 6.0

    res = corrector.get_corrected_location(capture_time=capture_time)
    corrector.stop()
    gps.stop()

    assert res["is_corrected"] is True
    assert res["correction_method"] == "dead_reckoning_imu"
    assert res["uncertainty_meters"] > 5.0



def test_offline_storage_with_correction_telemetry():
    temp_dir = tempfile.mkdtemp()
    try:
        storage = OfflineStorage(data_dir=temp_dir)
        dummy_img = b"fake_jpeg_image_bytes_123"

        inc_id = storage.save_incident(
            image_bytes=dummy_img,
            latitude=6.762942,
            longitude=80.004700,
            confidence=0.88,
            has_gps_fix=True,
            raw_latitude=6.762915,
            raw_longitude=80.004667,
            is_corrected=True,
            correction_method="fused_gps_imu",
            speed_kmh=24.5,
            heading_deg=85.0,
            offset_meters=5.2
        )

        pending = storage.get_pending_sync(limit=5)
        assert len(pending) == 1
        item = pending[0]
        assert item["id"] == inc_id
        assert abs(item["latitude"] - 6.762942) < 1e-5
        assert abs(item["raw_latitude"] - 6.762915) < 1e-5
        assert item["is_corrected"] == 1
        assert item["correction_method"] == "fused_gps_imu"
        assert item["offset_meters"] == 5.2
        assert item["heading_deg"] == 85.0

        storage.mark_as_synced(inc_id)
        assert len(storage.get_pending_sync()) == 0
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


def test_end_to_end_controller_pipeline():
    temp_dir = tempfile.mkdtemp()
    try:
        controller = EdgeMasterController(
            model_path="models/trash_classifier_384.onnx",
            data_dir=temp_dir,
            threshold=0.2,  # Low threshold so dummy frame triggers incident
            lookahead_meters=3.5
        )
        controller.start()
        time.sleep(0.2)

        # Create synthetic image with valid texture and contrast
        import numpy as np
        img = Image.fromarray(np.random.randint(50, 200, (384, 384, 3), dtype=np.uint8))
        import io
        buf = io.BytesIO()
        img.save(buf, format="JPEG")
        img_bytes = buf.getvalue()

        # Evaluate frame
        is_litter, conf, inc_id = controller.evaluate_frame(img, img_bytes)

        assert is_litter is True
        assert inc_id is not None

        # Check local DB saved with corrected coordinates
        stats = controller.storage.get_stats()
        assert stats["total"] >= 1

        with controller.storage._get_connection() as conn:
            row = conn.execute("SELECT * FROM local_reports WHERE id = ?", (inc_id,)).fetchone()
            assert row is not None
            assert row["is_corrected"] == 1
            assert row["correction_method"] in ("fused_gps_imu", "dead_reckoning_imu", "default_fallback")
            assert row["offset_meters"] >= 3.0

        controller.stop()
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


if __name__ == "__main__":
    if pytest:
        pytest.main(["-v", __file__])
    else:
        test_parse_nmea_coordinates()
        test_geodesic_projection_cardinals()
        test_stationary_location_correction()
        test_moving_vehicle_latency_and_lookahead()
        test_dead_reckoning_during_gps_loss()
        test_offline_storage_with_correction_telemetry()
        test_end_to_end_controller_pipeline()
        print("All location fusion tests passed successfully!")

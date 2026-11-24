import collections
import logging
import math
import threading
import time
from typing import Dict, Any, Optional, Tuple

from gps_tracker import GPSReader
from mpu6050_sensor import MPU6050

logger = logging.getLogger("LocationFusion")

# WGS-84 Equatorial Earth radius in meters
EARTH_RADIUS_METERS = 6378137.0


def haversine_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculates great-circle distance in meters between two WGS-84 coordinates."""
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lon2 - lon1)
    a = (
        math.sin(d_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * (math.sin(d_lambda / 2.0) ** 2)
    )
    return 2.0 * EARTH_RADIUS_METERS * math.asin(min(1.0, math.sqrt(a)))


class LocationFusionCorrector:
    """
    Fuses high-frequency MPU-6050 accelerometer & gyroscope data with NEO-6M GPS fixes
    to accurately estimate the true ground location of detected litter.

    Corrects for:
    1. GPS Latency & Inference Lag: Vehicle continues moving during 1Hz GPS gaps and model inference.
    2. Camera Lookahead Distance: Camera captures ground several meters in front of the vehicle.
    3. GPS Outages & Multipath: Maintains dead reckoning via IMU double-integration when fix is lost.
    4. Vibration & Drift: Applies Zero-Velocity Updates (ZUPT) and low-pass filtering.
    """

    def __init__(
        self,
        gps_reader: GPSReader,
        imu_sensor: Optional[MPU6050] = None,
        lookahead_distance_meters: float = 3.0,
        forward_axis: str = "y",
        forward_axis_inverted: bool = False,
        sampling_rate_hz: float = 50.0,
        enable_dead_reckoning: bool = True
    ):
        self.gps = gps_reader
        self.imu = imu_sensor or MPU6050(allow_mock=True)
        self.lookahead_distance_meters = lookahead_distance_meters
        self.forward_axis = forward_axis
        self.forward_axis_inverted = forward_axis_inverted
        self.sampling_interval = 1.0 / max(10.0, sampling_rate_hz)
        self.enable_dead_reckoning = enable_dead_reckoning

        self._lock = threading.Lock()
        self.running = False
        self._thread: Optional[threading.Thread] = None

        # Filter state & dynamic motion
        self._alpha = 0.25  # Low-pass filter coefficient for forward acceleration
        self._filtered_a_fwd = 0.0
        self._current_velocity = 0.0  # m/s
        self._current_heading = 0.0   # degrees (0 = North, 90 = East, 180 = South, 270 = West)
        self._integrated_distance_since_anchor = 0.0 # meters

        # Stationary detection (Zero-Velocity Update - ZUPT)
        self._stationary_time = 0.0
        self._is_stationary = True

        # GPS Anchor snapshot
        self._last_gps_sync_time = 0.0
        self._anchor_lat: Optional[float] = None
        self._anchor_lon: Optional[float] = None
        self._anchor_time: float = 0.0
        self._anchor_speed_ms: float = 0.0
        self._has_valid_fix: bool = False
        self._satellites: int = 0
        self._hdop: float = 1.0

        # Ring buffer of recent motion states for sub-second interpolation
        # Item: (timestamp, forward_accel_ms2, velocity_ms, heading_deg, delta_dist_m)
        self._history = collections.deque(maxlen=250)

    def start(self):
        if self.running:
            return
        self.running = True
        self._thread = threading.Thread(target=self._fusion_loop, daemon=True)
        self._thread.start()
        logger.info(
            f"LocationFusionCorrector started (Rate: {1.0 / self.sampling_interval:.0f} Hz, "
            f"Lookahead: {self.lookahead_distance_meters}m, ForwardAxis: {self.forward_axis})"
        )

    def stop(self):
        self.running = False
        if self._thread:
            self._thread.join(timeout=2.0)
        logger.info("LocationFusionCorrector stopped.")

    def _fusion_loop(self):
        prev_time = time.time()

        while self.running:
            loop_start = time.time()
            dt = max(0.001, loop_start - prev_time)
            prev_time = loop_start

            # 1. Sync latest GPS fix if updated
            self._check_and_sync_gps()

            # 2. Sample IMU accelerometer and gyroscope
            imu_data = self.imu.read_raw_data()
            raw_accel_g = imu_data["accel"].get(self.forward_axis, 0.0)
            if self.forward_axis_inverted:
                raw_accel_g = -raw_accel_g

            a_fwd_ms2 = raw_accel_g * MPU6050.STANDARD_GRAVITY
            dynamic_motion = imu_data.get("dynamic_motion", 0.0)
            is_moving = imu_data.get("is_moving", False)
            yaw_rate_degs = imu_data["gyro"].get("z", 0.0)

            # Apply low-pass filter to reject engine vibration & road rumble
            self._filtered_a_fwd = (self._alpha * a_fwd_ms2) + ((1.0 - self._alpha) * self._filtered_a_fwd)

            with self._lock:
                # 3. Heading integration from gyroscope (deg/s)
                if abs(yaw_rate_degs) > 0.5:
                    self._current_heading = (self._current_heading + (yaw_rate_degs * dt)) % 360.0

                # 4. Zero-Velocity Update (ZUPT)
                # When stationary, vehicle speed must be 0 (cancels accelerometer integration drift)
                gps_stopped = self._has_valid_fix and self._anchor_speed_ms < 0.42
                imu_calm = dynamic_motion < 0.10 and (not is_moving) and self._anchor_speed_ms < 0.5
                if gps_stopped or imu_calm:
                    self._stationary_time += dt
                    if self._stationary_time > 0.4:
                        self._is_stationary = True
                        self._current_velocity = 0.0
                        self._filtered_a_fwd = 0.0
                else:
                    self._stationary_time = 0.0
                    self._is_stationary = False
                    # Forward integration: v = max(0, v + a * dt)
                    self._current_velocity = max(0.0, self._current_velocity + (self._filtered_a_fwd * dt))

                # Step displacement
                step_dist = self._current_velocity * dt
                self._integrated_distance_since_anchor += step_dist

                # Store history record
                self._history.append((
                    loop_start,
                    self._filtered_a_fwd,
                    self._current_velocity,
                    self._current_heading,
                    step_dist
                ))

            # Maintain constant loop rate
            elapsed = time.time() - loop_start
            sleep_time = max(0.001, self.sampling_interval - elapsed)
            time.sleep(sleep_time)

    def _check_and_sync_gps(self):
        gps_state = self.gps.get_location()
        gps_last_updated = gps_state.get("last_updated", 0.0)

        if gps_last_updated > self._last_gps_sync_time:
            self._last_gps_sync_time = gps_last_updated
            lat = gps_state.get("latitude")
            lon = gps_state.get("longitude")
            speed_kmh = gps_state.get("speed_kmh", 0.0)
            heading = gps_state.get("heading")
            has_fix = gps_state.get("has_fix", False)
            satellites = gps_state.get("satellites", 0)
            hdop = gps_state.get("hdop", 1.0)

            with self._lock:
                if lat is not None and lon is not None:
                    self._anchor_lat = lat
                    self._anchor_lon = lon
                    self._anchor_time = gps_last_updated
                    self._has_valid_fix = has_fix
                    self._satellites = satellites
                    self._hdop = hdop

                    # Fused velocity correction: Anchor with GPS ground speed
                    speed_ms = max(0.0, speed_kmh / 3.6)
                    self._anchor_speed_ms = speed_ms
                    
                    if has_fix:
                        # Re-align velocity to prevent runaway integration drift
                        if speed_ms > 0.4:
                            self._is_stationary = False
                            self._current_velocity = (0.75 * speed_ms) + (0.25 * self._current_velocity)
                        elif self._is_stationary:
                            self._current_velocity = 0.0
                        else:
                            self._current_velocity = (0.75 * speed_ms) + (0.25 * self._current_velocity)

                        # Re-align heading if vehicle is moving or test mock provided
                        if heading is not None and (speed_ms > 0.8 or gps_state.get("is_mock") or self._current_heading == 0.0):
                            self._current_heading = heading

                        # Reset accumulated distance since this new anchor
                        self._integrated_distance_since_anchor = 0.0

    @staticmethod
    def haversine_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        return haversine_meters(lat1, lon1, lat2, lon2)

    def is_stationary(self) -> bool:
        with self._lock:
            return self._is_stationary

    @staticmethod
    def project_geodesic(lat: float, lon: float, distance_meters: float, heading_deg: float) -> Tuple[float, float]:
        """
        Calculates destination coordinates given starting point, forward distance (m), and bearing (deg).
        Uses standard spherical Earth model for roadside scale (< 1 km).
        """
        heading_rad = math.radians(heading_deg % 360.0)
        delta_north = distance_meters * math.cos(heading_rad)
        delta_east = distance_meters * math.sin(heading_rad)

        delta_lat = (delta_north / EARTH_RADIUS_METERS) * (180.0 / math.pi)
        lat_rad = math.radians(lat)
        cos_lat = math.cos(lat_rad)
        if abs(cos_lat) < 1e-6:
            cos_lat = 1e-6

        delta_lon = (delta_east / (EARTH_RADIUS_METERS * cos_lat)) * (180.0 / math.pi)

        return lat + delta_lat, lon + delta_lon

    def get_corrected_location(
        self,
        capture_time: Optional[float] = None,
        lookahead_distance: Optional[float] = None
    ) -> Dict[str, Any]:
        """
        Computes the corrected ground location of detected litter.

        Args:
            capture_time: Epoch timestamp when the camera shutter captured the frame.
                          If None, current system time is used.
            lookahead_distance: Distance in meters from camera bumper to road surface where litter lies.
                                Defaults to self.lookahead_distance_meters (e.g. 3.0m).

        Returns:
            Dictionary containing corrected coordinates, raw GPS coordinates, offset distance,
            heading, velocity, and correction method used.
        """
        t_event = capture_time if capture_time is not None else time.time()
        d_lookahead = lookahead_distance if lookahead_distance is not None else self.lookahead_distance_meters

        # Default fallback coordinates (Moratuwa / Panadura corridor) if GPS has never received any data
        default_lat, default_lon = 6.762915, 80.004667

        with self._lock:
            anchor_lat = self._anchor_lat or default_lat
            anchor_lon = self._anchor_lon or default_lon
            anchor_time = self._anchor_time or t_event
            has_fix = self._has_valid_fix
            satellites = self._satellites
            hdop = self._hdop
            current_heading = self._current_heading
            current_velocity = self._current_velocity
            current_a_fwd = self._filtered_a_fwd

            # Determine elapsed latency since GPS anchor was stamped
            delta_t = max(0.0, t_event - anchor_time)

            # 1. Compute displacement traveled by vehicle during delta_t
            # If delta_t is within our ring buffer history, calculate exact integration
            traveled_dist = 0.0
            if delta_t > 0:
                # Sum distance from ring buffer for samples within [anchor_time, t_event]
                relevant_samples = [s for s in self._history if s[0] >= anchor_time and s[0] <= (t_event + 0.05)]
                if len(relevant_samples) >= 2:
                    traveled_dist = sum(s[4] for s in relevant_samples)
                else:
                    # Kinematic estimate: d = v * dt + 0.5 * a * dt^2
                    traveled_dist = max(0.0, (current_velocity * delta_t) + (0.5 * current_a_fwd * (delta_t ** 2)))

            # 2. Total forward offset: Travel latency displacement + Camera lookahead ground distance
            total_forward_offset = traveled_dist + d_lookahead

            # 3. Determine correction method & position uncertainty
            if has_fix and delta_t < 4.0:
                method = "fused_gps_imu"
                uncertainty_m = round(2.0 * hdop + (0.1 * delta_t) + (0.15 * d_lookahead), 2)
            elif self._anchor_lat is not None and self.enable_dead_reckoning:
                method = "dead_reckoning_imu"
                uncertainty_m = round(5.0 + (0.4 * delta_t) + (0.2 * d_lookahead), 2)
            else:
                method = "default_fallback"
                uncertainty_m = 25.0

            # 4. Project coordinates along current heading
            corr_lat, corr_lon = self.project_geodesic(
                lat=anchor_lat,
                lon=anchor_lon,
                distance_meters=total_forward_offset,
                heading_deg=current_heading
            )

            speed_kmh = round(current_velocity * 3.6, 2)

            return {
                "latitude": round(corr_lat, 7),
                "longitude": round(corr_lon, 7),
                "raw_latitude": round(anchor_lat, 7),
                "raw_longitude": round(anchor_lon, 7),
                "is_corrected": True,
                "correction_method": method,
                "lookahead_meters": round(d_lookahead, 2),
                "travel_displacement_meters": round(traveled_dist, 2),
                "total_offset_meters": round(total_forward_offset, 2),
                "heading_deg": round(current_heading, 1),
                "speed_kmh": speed_kmh,
                "acceleration_ms2": round(current_a_fwd, 3),
                "uncertainty_meters": uncertainty_m,
                "has_gps_fix": has_fix,
                "satellites": satellites,
                "is_stationary": self._is_stationary,
                "latency_ms": round(delta_t * 1000.0, 1),
                "timestamp": int(t_event * 1000)
            }


if __name__ == "__main__":
    gps = GPSReader()
    imu = MPU6050(allow_mock=True)
    corrector = LocationFusionCorrector(gps_reader=gps, imu_sensor=imu, lookahead_distance_meters=3.5)
    
    gps.start()
    corrector.start()
    
    print("Testing LocationFusionCorrector...")
    time.sleep(0.5)

    # Test 1: Stationary reading
    res_stationary = corrector.get_corrected_location()
    print("\n[Stationary Test]")
    print(f"Raw GPS:       ({res_stationary['raw_latitude']}, {res_stationary['raw_longitude']})")
    print(f"Corrected:     ({res_stationary['latitude']}, {res_stationary['longitude']})")
    print(f"Total Offset:  {res_stationary['total_offset_meters']}m (Lookahead: {res_stationary['lookahead_meters']}m)")
    print(f"Method:        {res_stationary['correction_method']} | Heading: {res_stationary['heading_deg']}°")

    # Test 2: Moving vehicle simulation (30 km/h, heading 90° East)
    print("\n[Moving Test - 30 km/h East]")
    gps.set_simulated_location(
        latitude=6.762915,
        longitude=80.004667,
        speed_kmh=30.0,
        heading=90.0,
        has_fix=True,
        satellites=8
    )
    imu.set_simulated_motion(is_moving=True, forward_accel_g=0.05, yaw_rate_degs=0.0)
    time.sleep(0.5)

    res_moving = corrector.get_corrected_location(lookahead_distance=4.0)
    print(f"Raw GPS:       ({res_moving['raw_latitude']}, {res_moving['raw_longitude']})")
    print(f"Corrected:     ({res_moving['latitude']}, {res_moving['longitude']})")
    print(f"Total Offset:  {res_moving['total_offset_meters']}m (Traveled: {res_moving['travel_displacement_meters']}m + Lookahead: {res_moving['lookahead_meters']}m)")
    print(f"Method:        {res_moving['correction_method']} | Speed: {res_moving['speed_kmh']} km/h | Heading: {res_moving['heading_deg']}°")

    corrector.stop()
    gps.stop()

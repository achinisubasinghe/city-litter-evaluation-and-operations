import collections
import logging
import math
import random
import time
from typing import Dict, Any, Tuple, Optional, Deque

logger = logging.getLogger("MPU6050")


class MPU6050:
    PWR_MGMT_1   = 0x6B
    SMPLRT_DIV   = 0x19
    CONFIG       = 0x1A
    GYRO_CONFIG  = 0x1B
    ACCEL_CONFIG = 0x1C
    INT_ENABLE   = 0x38
    ACCEL_XOUT_H = 0x3B
    TEMP_OUT_H   = 0x41
    GYRO_XOUT_H  = 0x43

    ACCEL_SCALE_2G  = 16384.0
    GYRO_SCALE_250  = 131.0
    STANDARD_GRAVITY = 9.80665

    def __init__(
        self,
        bus_id: int = 1,
        address: int = 0x68,
        allow_mock: bool = True,
        motion_threshold_g: float = 0.025,
        stationary_debounce_sec: float = 1.5,
        history_window_size: int = 20
    ):
        self.bus_id = bus_id
        self.address = address
        self.allow_mock = allow_mock
        self.motion_threshold_g = motion_threshold_g
        self.stationary_debounce_sec = stationary_debounce_sec
        self.history_window_size = history_window_size
        self.bus = None
        self.is_mock = False

        self.accel_bias = {"x": 0.0, "y": 0.0, "z": 0.0}
        self.gyro_bias = {"x": 0.0, "y": 0.0, "z": 0.0}

        self._sim_is_moving = False
        self._sim_forward_accel_g = 0.0
        self._sim_yaw_rate_degs = 0.0

        self._mag_history: Deque[float] = collections.deque(maxlen=self.history_window_size)
        self._last_motion_time: float = 0.0
        self._is_moving: bool = False
        self._stationary_since: Optional[float] = time.time()
        self._gravity_baseline: Optional[float] = None

        self._init_sensor()

    def _init_sensor(self):
        try:
            try:
                import smbus2
                self.bus = smbus2.SMBus(self.bus_id)
            except ImportError:
                import smbus
                self.bus = smbus.SMBus(self.bus_id)

            self.bus.write_byte_data(self.address, self.PWR_MGMT_1, 0x00)
            time.sleep(0.05)
            self.bus.write_byte_data(self.address, self.SMPLRT_DIV, 0x07)
            self.bus.write_byte_data(self.address, self.CONFIG, 0x03)
            self.bus.write_byte_data(self.address, self.GYRO_CONFIG, 0x00)
            self.bus.write_byte_data(self.address, self.ACCEL_CONFIG, 0x00)
            logger.info(f"MPU-6050 hardware initialized on I2C bus {self.bus_id} at 0x{self.address:02X}")
        except Exception as e:
            if self.allow_mock:
                self.is_mock = True
                self.bus = None
                logger.info(f"MPU-6050 hardware not accessible ({e}). Running in software simulation mode.")
            else:
                raise

    def set_simulated_motion(self, is_moving: bool = False, forward_accel_g: float = 0.0, yaw_rate_degs: float = 0.0):
        self._sim_is_moving = is_moving
        self._sim_forward_accel_g = forward_accel_g
        self._sim_yaw_rate_degs = yaw_rate_degs
        now = time.time()
        if is_moving:
            self._is_moving = True
            self._last_motion_time = now
            self._stationary_since = None
        else:
            self._is_moving = False
            self._last_motion_time = now - self.stationary_debounce_sec - 1.0
            if self._stationary_since is None:
                self._stationary_since = now - self.stationary_debounce_sec

    def is_moving(self) -> bool:
        return self._is_moving

    def is_stationary(self) -> bool:
        return not self._is_moving

    def get_stationary_duration(self) -> float:
        if self._is_moving or self._stationary_since is None:
            return 0.0
        return max(0.0, time.time() - self._stationary_since)

    def _read_word_2c(self, reg: int) -> int:
        if self.is_mock or not self.bus:
            return 0
        high = self.bus.read_byte_data(self.address, reg)
        low = self.bus.read_byte_data(self.address, reg + 1)
        val = (high << 8) + low
        if val >= 0x8000:
            val = -((65535 - val) + 1)
        return val

    def read_raw_data(self) -> Dict[str, Any]:
        now = time.time()
        if self.is_mock or not self.bus:
            jitter = (random.random() - 0.5) * 0.02
            if self._sim_is_moving:
                ax = (random.random() - 0.5) * 0.05
                ay = self._sim_forward_accel_g + jitter
                az = 1.0 + (random.random() - 0.5) * 0.04
                gx = (random.random() - 0.5) * 0.5
                gy = (random.random() - 0.5) * 0.5
                gz = self._sim_yaw_rate_degs + (random.random() - 0.5) * 0.2
                dynamic_motion = 0.10 + abs(self._sim_forward_accel_g)
                self._is_moving = True
                self._last_motion_time = now
                self._stationary_since = None
                stationary_duration = 0.0
            else:
                ax = jitter * 0.2
                ay = jitter * 0.2
                az = 1.0 + jitter * 0.2
                gx = (random.random() - 0.5) * 0.05
                gy = (random.random() - 0.5) * 0.05
                gz = (random.random() - 0.5) * 0.05
                dynamic_motion = 0.005 + abs(jitter * 0.5)
                self._is_moving = False
                if self._stationary_since is None:
                    self._stationary_since = now - self.stationary_debounce_sec
                stationary_duration = max(0.0, now - self._stationary_since)

            temp_c = 28.5 + jitter * 2.0
            accel_mag = math.sqrt(ax * ax + ay * ay + az * az)

            return {
                "accel": {"x": round(ax, 3), "y": round(ay, 3), "z": round(az, 3)},
                "gyro": {"x": round(gx, 2), "y": round(gy, 2), "z": round(gz, 2)},
                "temperature_c": round(temp_c, 1),
                "accel_magnitude_g": round(accel_mag, 3),
                "dynamic_motion": round(dynamic_motion, 4),
                "is_moving": self._is_moving,
                "is_stationary": not self._is_moving,
                "stationary_duration_sec": round(stationary_duration, 2),
                "is_mock": True
            }

        try:
            data = self.bus.read_i2c_block_data(self.address, self.ACCEL_XOUT_H, 14)

            def to_int16(h: int, l: int) -> int:
                val = (h << 8) | l
                return val - 65536 if val > 32767 else val

            raw_ax = to_int16(data[0], data[1]) / self.ACCEL_SCALE_2G
            raw_ay = to_int16(data[2], data[3]) / self.ACCEL_SCALE_2G
            raw_az = to_int16(data[4], data[5]) / self.ACCEL_SCALE_2G

            temp_raw = to_int16(data[6], data[7])
            temp_c = (temp_raw / 340.0) + 36.53

            raw_gx = to_int16(data[8], data[9]) / self.GYRO_SCALE_250
            raw_gy = to_int16(data[10], data[11]) / self.GYRO_SCALE_250
            raw_gz = to_int16(data[12], data[13]) / self.GYRO_SCALE_250

            ax = raw_ax - self.accel_bias["x"]
            ay = raw_ay - self.accel_bias["y"]
            az = raw_az - self.accel_bias["z"]

            gx = raw_gx - self.gyro_bias["x"]
            gy = raw_gy - self.gyro_bias["y"]
            gz = raw_gz - self.gyro_bias["z"]

            accel_mag = math.sqrt(ax * ax + ay * ay + az * az)
            self._mag_history.append(accel_mag)

            if self._gravity_baseline is None:
                self._gravity_baseline = accel_mag
            else:
                self._gravity_baseline = 0.98 * self._gravity_baseline + 0.02 * accel_mag

            history_len = len(self._mag_history)
            if history_len >= 3:
                mean_m = sum(self._mag_history) / history_len
                var_m = sum((m - mean_m) ** 2 for m in self._mag_history) / history_len
                std_m = math.sqrt(var_m)
                peak_delta = max(self._mag_history) - min(self._mag_history)
                instant_delta = abs(accel_mag - self._gravity_baseline)
                dynamic_motion = max(std_m * 2.0, peak_delta * 0.5, instant_delta)
            else:
                dynamic_motion = abs(accel_mag - self._gravity_baseline)

            if dynamic_motion >= self.motion_threshold_g:
                self._last_motion_time = now
                self._is_moving = True
                self._stationary_since = None
            else:
                time_still = now - self._last_motion_time
                if time_still >= self.stationary_debounce_sec:
                    self._is_moving = False
                    if self._stationary_since is None:
                        self._stationary_since = now - self.stationary_debounce_sec

            if not self._is_moving and self._stationary_since is not None:
                stationary_duration = max(0.0, now - self._stationary_since)
            else:
                stationary_duration = 0.0

            return {
                "accel": {"x": round(ax, 3), "y": round(ay, 3), "z": round(az, 3)},
                "gyro": {"x": round(gx, 2), "y": round(gy, 2), "z": round(gz, 2)},
                "temperature_c": round(temp_c, 1),
                "accel_magnitude_g": round(accel_mag, 3),
                "dynamic_motion": round(dynamic_motion, 4),
                "is_moving": self._is_moving,
                "is_stationary": not self._is_moving,
                "stationary_duration_sec": round(stationary_duration, 2),
                "is_mock": False
            }
        except Exception as e:
            logger.warning(f"Error reading I2C MPU6050: {e}")
            return {
                "accel": {"x": 0.0, "y": 0.0, "z": 1.0},
                "gyro": {"x": 0.0, "y": 0.0, "z": 0.0},
                "temperature_c": 25.0,
                "accel_magnitude_g": 1.0,
                "dynamic_motion": 0.0,
                "is_moving": False,
                "is_stationary": True,
                "stationary_duration_sec": 0.0,
                "is_mock": False
            }

    def calibrate_biases(self, num_samples: int = 40, delay_sec: float = 0.02):
        if self.is_mock or not self.bus:
            logger.info("Mock MPU6050: Biases calibrated to zero.")
            return

        logger.info(f"Calibrating MPU6050 biases over {num_samples} stationary samples...")
        ax_sum = ay_sum = 0.0
        gx_sum = gy_sum = gz_sum = 0.0

        for _ in range(num_samples):
            try:
                data = self.bus.read_i2c_block_data(self.address, self.ACCEL_XOUT_H, 14)
                def to_int16(h: int, l: int) -> int:
                    val = (h << 8) | l
                    return val - 65536 if val > 32767 else val

                ax_sum += to_int16(data[0], data[1]) / self.ACCEL_SCALE_2G
                ay_sum += to_int16(data[2], data[3]) / self.ACCEL_SCALE_2G
                gx_sum += to_int16(data[8], data[9]) / self.GYRO_SCALE_250
                gy_sum += to_int16(data[10], data[11]) / self.GYRO_SCALE_250
                gz_sum += to_int16(data[12], data[13]) / self.GYRO_SCALE_250
            except Exception:
                pass
            time.sleep(delay_sec)

        self.accel_bias["x"] = round(ax_sum / num_samples, 4)
        self.accel_bias["y"] = round(ay_sum / num_samples, 4)
        self.gyro_bias["x"] = round(gx_sum / num_samples, 3)
        self.gyro_bias["y"] = round(gy_sum / num_samples, 3)
        self.gyro_bias["z"] = round(gz_sum / num_samples, 3)
        logger.info(f"MPU6050 calibration complete: accel_bias={self.accel_bias}, gyro_bias={self.gyro_bias}")

    def get_forward_accel_ms2(self, forward_axis: str = "y", inverted: bool = False) -> float:
        raw = self.read_raw_data()
        accel_g = raw["accel"].get(forward_axis, 0.0)
        if inverted:
            accel_g = -accel_g
        return accel_g * self.STANDARD_GRAVITY

    def close(self):
        if self.bus:
            try:
                self.bus.close()
            except Exception:
                pass
            self.bus = None


if __name__ == "__main__":
    sensor = MPU6050()
    print(f"MPU-6050 Mode: {'Mock/Simulation' if sensor.is_mock else 'Hardware I2C'}")
    for _ in range(5):
        d = sensor.read_raw_data()
        status = "MOVING" if d["is_moving"] else f"STATIONARY ({d['stationary_duration_sec']}s)"
        print(f"Motion: {status} | DynMotion: {d['dynamic_motion']:.4f}g | Accel: ({d['accel']['x']:+0.2f}, {d['accel']['y']:+0.2f}, {d['accel']['z']:+0.2f}) g | Temp: {d['temperature_c']}C")
        time.sleep(0.3)
    sensor.close()

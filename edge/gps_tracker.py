from datetime import datetime, timezone
import logging
import threading
import time
from typing import Optional, Dict, Any

try:
    import serial
except ImportError:
    serial = None

logger = logging.getLogger("GPSReader")


def parse_nmea_coord(raw_value: str, direction: str) -> Optional[float]:
    if not raw_value or not direction:
        return None
    try:
        if direction in ('N', 'S'):
            degrees = float(raw_value[:2])
            minutes = float(raw_value[2:])
        else:
            degrees = float(raw_value[:3])
            minutes = float(raw_value[3:])
        
        decimal = degrees + (minutes / 60.0)
        if direction in ('S', 'W'):
            decimal = -decimal
        return round(decimal, 6)
    except (ValueError, IndexError):
        return None


class GPSReader:
    def __init__(self, port: str = "/dev/serial0", baudrate: int = 9600):
        self.port = port
        self.baudrate = baudrate
        self.running = False
        self._thread: Optional[threading.Thread] = None
        self._lock = threading.Lock()
        self._clock_offset_sec: Optional[float] = None
        
        self.state: Dict[str, Any] = {
            "latitude": None,
            "longitude": None,
            "altitude": None,
            "speed_kmh": 0.0,
            "heading": 0.0,
            "satellites": 0,
            "hdop": 1.0,
            "has_fix": False,
            "utc_time": None,
            "utc_date": None,
            "timestamp": None,
            "last_updated": 0.0,
            "is_mock": False
        }

    def start(self):
        if self.running:
            return
        self.running = True
        self._thread = threading.Thread(target=self._reader_loop, daemon=True)
        self._thread.start()

    def stop(self):
        self.running = False
        if self._thread:
            self._thread.join(timeout=2.0)

    def set_simulated_location(
        self,
        latitude: float,
        longitude: float,
        speed_kmh: float = 0.0,
        heading: float = 0.0,
        has_fix: bool = True,
        satellites: int = 8
    ):
        """Allows test suites and simulations to feed precise coordinates and headings."""
        with self._lock:
            self.state["latitude"] = latitude
            self.state["longitude"] = longitude
            self.state["speed_kmh"] = speed_kmh
            self.state["heading"] = heading
            self.state["has_fix"] = has_fix
            self.state["satellites"] = satellites
            self.state["last_updated"] = time.time()
            self.state["is_mock"] = True

    def get_corrected_timestamp_ms(self, epoch_sec: Optional[float] = None) -> int:
        """Applies GPS UTC clock offset when system clock differs (e.g., Pi without RTC)."""
        base_sec = epoch_sec if epoch_sec is not None else time.time()
        with self._lock:
            offset = self._clock_offset_sec
        if offset is not None and abs(offset) > 5.0:
            base_sec += offset
        return int(base_sec * 1000)

    def _reader_loop(self):
        if serial is None:
            logger.info("pyserial not available or running in mock environment. Using default GPS simulation.")
            with self._lock:
                if not self.state["is_mock"] or self.state["latitude"] is None:
                    self.state["latitude"] = 6.762915
                    self.state["longitude"] = 80.004667
                    self.state["speed_kmh"] = 0.0
                    self.state["heading"] = 0.0
                    self.state["has_fix"] = True
                    self.state["satellites"] = 6
                    self.state["last_updated"] = time.time()
                    self.state["is_mock"] = True
            while self.running:
                time.sleep(1.0)
            return

        while self.running:
            try:
                with serial.Serial(self.port, self.baudrate, timeout=1.0) as ser:
                    logger.info(f"Connected to GPS serial on {self.port} at {self.baudrate} baud")
                    while self.running:
                        line = ser.readline().decode('ascii', errors='ignore').strip()
                        if line:
                            self._parse_line(line)
            except Exception as e:
                logger.warning(f"GPS serial error on {self.port}: {e}")
                time.sleep(1.0)

    def _parse_line(self, line: str):
        if not line.startswith('$'):
            return

        parts = line.split('*')[0].split(',')
        tag = parts[0]

        with self._lock:
            if tag in ('$GPRMC', '$GNRMC') and len(parts) >= 10:
                raw_time = parts[1]
                status = parts[2]
                raw_lat = parts[3]
                lat_dir = parts[4]
                raw_lon = parts[5]
                lon_dir = parts[6]
                speed_knots = parts[7]
                heading = parts[8]
                raw_date = parts[9]

                lat = parse_nmea_coord(raw_lat, lat_dir)
                lon = parse_nmea_coord(raw_lon, lon_dir)

                if lat is not None and lon is not None:
                    self.state["latitude"] = lat
                    self.state["longitude"] = lon
                
                has_fix = (status == 'A')
                self.state["has_fix"] = has_fix
                self.state["utc_time"] = raw_time
                self.state["utc_date"] = raw_date

                if has_fix and len(raw_time) >= 6 and len(raw_date) == 6:
                    try:
                        gps_dt = datetime.strptime(f"{raw_date}{raw_time[:6]}", "%d%m%y%H%M%S").replace(tzinfo=timezone.utc)
                        if gps_dt.year >= 2024:
                            self._clock_offset_sec = gps_dt.timestamp() - time.time()
                    except ValueError:
                        pass
                
                try:
                    if speed_knots:
                        self.state["speed_kmh"] = round(float(speed_knots) * 1.852, 2)
                except ValueError:
                    pass

                try:
                    if heading:
                        self.state["heading"] = round(float(heading), 1)
                except ValueError:
                    pass

                self.state["last_updated"] = time.time()
                self.state["is_mock"] = False

            elif tag in ('$GPGGA', '$GNGGA') and len(parts) >= 10:
                raw_lat = parts[2]
                lat_dir = parts[3]
                raw_lon = parts[4]
                lon_dir = parts[5]
                fix_quality = parts[6]
                satellites = parts[7]
                hdop = parts[8] if len(parts) > 8 else "1.0"
                raw_alt = parts[9]

                lat = parse_nmea_coord(raw_lat, lat_dir)
                lon = parse_nmea_coord(raw_lon, lon_dir)

                if lat is not None and lon is not None:
                    self.state["latitude"] = lat
                    self.state["longitude"] = lon

                try:
                    self.state["satellites"] = int(satellites) if satellites else 0
                except ValueError:
                    pass

                try:
                    self.state["hdop"] = float(hdop) if hdop else 1.0
                except ValueError:
                    pass

                try:
                    if raw_alt:
                        self.state["altitude"] = round(float(raw_alt), 1)
                except ValueError:
                    pass

                self.state["has_fix"] = (fix_quality in ('1', '2'))
                self.state["last_updated"] = time.time()
                self.state["is_mock"] = False

    def get_location(self) -> Dict[str, Any]:
        with self._lock:
            return dict(self.state)


if __name__ == "__main__":
    gps = GPSReader()
    gps.start()
    time.sleep(0.5)
    loc = gps.get_location()
    print(f"Fix: {'YES' if loc['has_fix'] else 'NO'} | Sats: {loc['satellites']} | Lat: {loc['latitude']} | Lon: {loc['longitude']} | Speed: {loc['speed_kmh']} km/h")
    gps.stop()

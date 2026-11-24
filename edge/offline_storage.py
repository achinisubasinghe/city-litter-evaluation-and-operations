import math
import os
import sqlite3
import time
import uuid
from typing import List, Dict, Any, Optional

DEFAULT_DATA_DIR = os.environ.get("TRASH_DATA_DIR", "/var/trash_data")
EARTH_RADIUS_METERS = 6378137.0


def _haversine_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lon2 - lon1)
    a = (
        math.sin(d_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * (math.sin(d_lambda / 2.0) ** 2)
    )
    return 2.0 * EARTH_RADIUS_METERS * math.asin(min(1.0, math.sqrt(a)))


class OfflineStorage:
    def __init__(self, data_dir: str = DEFAULT_DATA_DIR):
        self.data_dir = data_dir
        self.db_path = os.path.join(self.data_dir, "offline_queue.db")
        self.img_dir = os.path.join(self.data_dir, "images")

        try:
            os.makedirs(self.img_dir, exist_ok=True)
        except PermissionError:
            fallback_dir = os.path.join(os.path.expanduser("~"), ".trash_data")
            self.data_dir = fallback_dir
            self.db_path = os.path.join(self.data_dir, "offline_queue.db")
            self.img_dir = os.path.join(self.data_dir, "images")
            os.makedirs(self.img_dir, exist_ok=True)
        self._init_db()

    def _get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path, timeout=10.0)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA busy_timeout = 5000;")
        conn.execute("PRAGMA synchronous = FULL;")
        return conn

    def _init_db(self):
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("PRAGMA journal_mode = WAL;")
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS local_reports (
                    id TEXT PRIMARY KEY,
                    image_path TEXT NOT NULL,
                    latitude REAL NOT NULL,
                    longitude REAL NOT NULL,
                    raw_latitude REAL,
                    raw_longitude REAL,
                    is_corrected INTEGER DEFAULT 0,
                    correction_method TEXT,
                    speed_kmh REAL DEFAULT 0.0,
                    heading_deg REAL DEFAULT 0.0,
                    offset_meters REAL DEFAULT 0.0,
                    quality_score REAL DEFAULT 1.0,
                    blur_score REAL DEFAULT 100.0,
                    visual_hash TEXT,
                    confidence REAL NOT NULL,
                    timestamp INTEGER NOT NULL,
                    has_gps_fix INTEGER NOT NULL,
                    synced INTEGER DEFAULT 0,
                    retry_count INTEGER DEFAULT 0,
                    created_at INTEGER NOT NULL
                );
            """)
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_synced ON local_reports(synced);")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_timestamp ON local_reports(timestamp);")

            # Check and run automatic column migrations if table existed from an older version
            cursor.execute("PRAGMA table_info(local_reports);")
            columns = [row[1] for row in cursor.fetchall()]

            migrations = [
                ("raw_latitude", "REAL"),
                ("raw_longitude", "REAL"),
                ("is_corrected", "INTEGER DEFAULT 0"),
                ("correction_method", "TEXT"),
                ("speed_kmh", "REAL DEFAULT 0.0"),
                ("heading_deg", "REAL DEFAULT 0.0"),
                ("offset_meters", "REAL DEFAULT 0.0"),
                ("quality_score", "REAL DEFAULT 1.0"),
                ("blur_score", "REAL DEFAULT 100.0"),
                ("visual_hash", "TEXT"),
            ]
            for col_name, col_type in migrations:
                if col_name not in columns:
                    cursor.execute(f"ALTER TABLE local_reports ADD COLUMN {col_name} {col_type};")

            conn.commit()

    def save_incident(
        self,
        image_bytes: bytes,
        latitude: float,
        longitude: float,
        confidence: float,
        has_gps_fix: bool = True,
        timestamp_ms: Optional[int] = None,
        raw_latitude: Optional[float] = None,
        raw_longitude: Optional[float] = None,
        is_corrected: bool = False,
        correction_method: Optional[str] = None,
        speed_kmh: Optional[float] = None,
        heading_deg: Optional[float] = None,
        offset_meters: Optional[float] = None,
        quality_score: Optional[float] = None,
        blur_score: Optional[float] = None,
        visual_hash: Optional[str] = None
    ) -> str:
        incident_id = str(uuid.uuid4())
        now_ms = timestamp_ms or int(time.time() * 1000)
        filename = f"litter_{now_ms}_{incident_id[:8]}.jpg"
        image_path = os.path.join(self.img_dir, filename)
        tmp_path = f"{image_path}.tmp"

        try:
            with open(tmp_path, "wb") as f:
                f.write(image_bytes)
                f.flush()
                os.fsync(f.fileno())
            os.replace(tmp_path, image_path)
        except Exception:
            if os.path.exists(tmp_path):
                try:
                    os.remove(tmp_path)
                except OSError:
                    pass
            raise

        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO local_reports (
                    id, image_path, latitude, longitude,
                    raw_latitude, raw_longitude, is_corrected, correction_method,
                    speed_kmh, heading_deg, offset_meters, quality_score, blur_score,
                    visual_hash, confidence, timestamp, has_gps_fix, synced, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
            """, (
                incident_id,
                image_path,
                latitude,
                longitude,
                raw_latitude if raw_latitude is not None else latitude,
                raw_longitude if raw_longitude is not None else longitude,
                1 if is_corrected else 0,
                correction_method or ("fused_gps_imu" if is_corrected else "raw_gps"),
                speed_kmh or 0.0,
                heading_deg or 0.0,
                offset_meters or 0.0,
                quality_score if quality_score is not None else 1.0,
                blur_score if blur_score is not None else 100.0,
                visual_hash,
                round(confidence, 4),
                now_ms,
                1 if has_gps_fix else 0,
                int(time.time())
            ))
            conn.commit()

        return incident_id

    def find_nearby_incident(
        self,
        latitude: float,
        longitude: float,
        radius_meters: float = 20.0,
        window_seconds: Optional[float] = 1800.0,
        now_ms: Optional[int] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Returns the nearest previously saved incident within `radius_meters`
        (and optional `window_seconds`), or None if no spatial duplicate exists.
        """
        if radius_meters <= 0:
            return None

        ref_ms = now_ms if now_ms is not None else int(time.time() * 1000)
        lat_delta = (radius_meters / EARTH_RADIUS_METERS) * (180.0 / math.pi)
        cos_lat = max(1e-6, abs(math.cos(math.radians(latitude))))
        lon_delta = lat_delta / cos_lat

        params: List[Any] = [
            latitude - lat_delta,
            latitude + lat_delta,
            longitude - lon_delta,
            longitude + lon_delta,
        ]
        time_clause = ""
        if window_seconds is not None and window_seconds > 0:
            cutoff_ms = ref_ms - int(window_seconds * 1000)
            time_clause = "AND timestamp >= ?"
            params.append(cutoff_ms)

        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(f"""
                SELECT id, latitude, longitude, confidence, timestamp, visual_hash, correction_method
                FROM local_reports
                WHERE latitude BETWEEN ? AND ?
                  AND longitude BETWEEN ? AND ?
                  AND (correction_method IS NULL OR correction_method != 'default_fallback')
                  {time_clause}
                ORDER BY timestamp DESC
                LIMIT 100
            """, params)
            rows = cursor.fetchall()

        nearest: Optional[Dict[str, Any]] = None
        nearest_dist = float("inf")
        for row in rows:
            dist = _haversine_meters(latitude, longitude, row["latitude"], row["longitude"])
            if dist <= radius_meters and dist < nearest_dist:
                nearest_dist = dist
                nearest = dict(row)
                nearest["distance_meters"] = round(dist, 2)

        return nearest

    def get_recent_visual_hashes(
        self,
        limit: int = 8,
        window_seconds: Optional[float] = 300.0,
        now_ms: Optional[int] = None
    ) -> List[str]:
        """Returns recent non-null visual dHash hex strings (newest first)."""
        ref_ms = now_ms if now_ms is not None else int(time.time() * 1000)
        params: List[Any] = []
        time_clause = ""
        if window_seconds is not None and window_seconds > 0:
            cutoff_ms = ref_ms - int(window_seconds * 1000)
            time_clause = "AND timestamp >= ?"
            params.append(cutoff_ms)
        params.append(limit)

        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(f"""
                SELECT visual_hash
                FROM local_reports
                WHERE visual_hash IS NOT NULL
                  AND visual_hash != ''
                  {time_clause}
                ORDER BY timestamp DESC
                LIMIT ?
            """, params)
            return [row["visual_hash"] for row in cursor.fetchall()]

    def get_pending_sync(self, limit: int = 10) -> List[Dict[str, Any]]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT id, image_path, latitude, longitude,
                       raw_latitude, raw_longitude, is_corrected, correction_method,
                       speed_kmh, heading_deg, offset_meters, quality_score, blur_score,
                       confidence, timestamp, has_gps_fix, retry_count
                FROM local_reports
                WHERE synced = 0
                ORDER BY retry_count ASC, timestamp ASC
                LIMIT ?
            """, (limit,))
            rows = cursor.fetchall()
            return [dict(row) for row in rows]

    def mark_as_synced(self, incident_id: str):
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("UPDATE local_reports SET synced = 1 WHERE id = ?", (incident_id,))
            conn.commit()

    def increment_retry(self, incident_id: str):
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("UPDATE local_reports SET retry_count = retry_count + 1 WHERE id = ?", (incident_id,))
            conn.commit()

    def get_stats(self) -> Dict[str, int]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM local_reports")
            total = cursor.fetchone()[0]
            cursor.execute("SELECT COUNT(*) FROM local_reports WHERE synced = 0")
            pending = cursor.fetchone()[0]
            cursor.execute("SELECT COUNT(*) FROM local_reports WHERE synced = 1")
            synced = cursor.fetchone()[0]
            return {"total": total, "pending": pending, "synced": synced}

    def cleanup_old_images(self, days_retention: int = 7):
        cutoff_sec = int(time.time()) - (days_retention * 86400)
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT id, image_path FROM local_reports
                WHERE synced = 1 AND created_at < ?
            """, (cutoff_sec,))
            rows = cursor.fetchall()
            for row in rows:
                path = row["image_path"]
                if os.path.exists(path):
                    try:
                        os.remove(path)
                    except OSError:
                        pass

import os
import sqlite3
import time
import uuid
from typing import List, Dict, Any, Optional

DEFAULT_DATA_DIR = os.environ.get("TRASH_DATA_DIR", "/var/trash_data")


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
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self):
        with self._get_connection() as conn:
            cursor = conn.cursor()
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
                    confidence REAL NOT NULL,
                    timestamp INTEGER NOT NULL,
                    has_gps_fix INTEGER NOT NULL,
                    synced INTEGER DEFAULT 0,
                    retry_count INTEGER DEFAULT 0,
                    created_at INTEGER NOT NULL
                );
            """)
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_synced ON local_reports(synced);")

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
        blur_score: Optional[float] = None
    ) -> str:
        incident_id = str(uuid.uuid4())
        now_ms = timestamp_ms or int(time.time() * 1000)
        filename = f"litter_{now_ms}_{incident_id[:8]}.jpg"
        image_path = os.path.join(self.img_dir, filename)

        with open(image_path, "wb") as f:
            f.write(image_bytes)

        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO local_reports (
                    id, image_path, latitude, longitude,
                    raw_latitude, raw_longitude, is_corrected, correction_method,
                    speed_kmh, heading_deg, offset_meters, quality_score, blur_score,
                    confidence, timestamp, has_gps_fix, synced, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
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
                round(confidence, 4),
                now_ms,
                1 if has_gps_fix else 0,
                int(time.time())
            ))
            conn.commit()

        return incident_id

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
                ORDER BY timestamp ASC
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

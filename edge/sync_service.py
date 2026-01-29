import json
import logging
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Optional, Dict, Any

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from offline_storage import OfflineStorage

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
logger = logging.getLogger("SyncService")

DEFAULT_CONVEX_URL = os.environ.get("CONVEX_URL", "https://savory-ram-12.convex.cloud")


class ConvexSyncService:
    def __init__(self, convex_url: str = DEFAULT_CONVEX_URL, storage: Optional[OfflineStorage] = None):
        self.convex_url = convex_url.rstrip("/")
        self.storage = storage or OfflineStorage()
        self.running = False

    def check_connectivity(self) -> bool:
        try:
            req = urllib.request.Request(
                f"{self.convex_url}/",
                headers={"User-Agent": "RpiEdgeSync/1.0"},
                method="GET"
            )
            with urllib.request.urlopen(req, timeout=4) as resp:
                return True
        except urllib.error.HTTPError:
            return True
        except Exception:
            try:
                with urllib.request.urlopen("https://1.1.1.1", timeout=3):
                    return True
            except Exception:
                return False

    def _call_mutation(self, path: str, args: Dict[str, Any]) -> Any:
        url = f"{self.convex_url}/api/mutation"
        payload = json.dumps({"path": path, "args": args}).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=payload,
            headers={
                "Content-Type": "application/json",
                "User-Agent": "RpiEdgeSync/1.0"
            },
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            if data.get("status") == "error":
                raise RuntimeError(f"Convex mutation error: {data.get('errorMessage')}")
            return data.get("value")

    def _get_upload_url(self) -> str:
        return self._call_mutation("reports:generateUploadUrl", {})

    def _upload_image_bytes(self, upload_url: str, image_bytes: bytes) -> str:
        req = urllib.request.Request(
            upload_url,
            data=image_bytes,
            headers={"Content-Type": "image/jpeg"},
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=20) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data["storageId"]

    def sync_batch(self, batch_size: int = 5) -> int:
        pending = self.storage.get_pending_sync(limit=batch_size)
        if not pending:
            return 0

        synced_count = 0
        for item in pending:
            item_id = item["id"]
            img_path = item["image_path"]

            if not os.path.exists(img_path):
                logger.warning(f"Image not found on disk: {img_path}. Marking synced.")
                self.storage.mark_as_synced(item_id)
                continue

            try:
                with open(img_path, "rb") as f:
                    image_bytes = f.read()

                upload_url = self._get_upload_url()
                storage_id = self._upload_image_bytes(upload_url, image_bytes)

                offset_m = item.get("offset_meters") or 0.0
                heading_deg = item.get("heading_deg") or 0.0
                method = item.get("correction_method") or "fused_gps_imu"
                conf_pct = int(item["confidence"] * 100)

                quality_score = item.get("quality_score")
                blur_score = item.get("blur_score")

                if item.get("is_corrected"):
                    q_str = f", Quality: {int(quality_score * 100)}%" if quality_score is not None else ""
                    caption = (
                        f"Autonomous roadside detection (Confidence: {conf_pct}%, "
                        f"Corrected: +{offset_m:.1f}m @ {heading_deg:.0f}°, {method}{q_str})"
                    )
                else:
                    caption = f"Autonomous roadside detection (Confidence: {conf_pct}%)"

                mutation_args = {
                    "photoStorageId": storage_id,
                    "latitude": item["latitude"],
                    "longitude": item["longitude"],
                    "confidence": item["confidence"],
                    "createdAt": item["timestamp"],
                    "deviceId": "rpi4-prototype",
                    "rawLatitude": item.get("raw_latitude"),
                    "rawLongitude": item.get("raw_longitude"),
                    "isLocationCorrected": bool(item.get("is_corrected", 0)),
                    "correctionMethod": method,
                    "speedKmh": item.get("speed_kmh"),
                    "heading": heading_deg,
                    "offsetMeters": offset_m,
                    "qualityScore": quality_score,
                    "blurScore": blur_score,
                    "caption": caption
                }
                res = self._call_mutation("reports:createReportFromEdge", mutation_args)
                self.storage.mark_as_synced(item_id)
                synced_count += 1
                logger.info(f"Synced report {item_id} -> Convex reportId: {res.get('reportId')}")
            except Exception as e:
                logger.error(f"Failed to sync report {item_id}: {e}")
                self.storage.increment_retry(item_id)

        return synced_count

    def run_daemon(self, check_interval: int = 15):
        self.running = True
        logger.info(f"Sync daemon started. Convex URL: {self.convex_url}")

        while self.running:
            try:
                stats = self.storage.get_stats()
                if stats["pending"] > 0:
                    if self.check_connectivity():
                        uploaded = self.sync_batch(batch_size=5)
                        if uploaded > 0:
                            logger.info(f"Uploaded {uploaded} reports to cloud database.")
                    else:
                        logger.warning("Device offline. Reports queued in local storage.")
                self.storage.cleanup_old_images(days_retention=7)
            except Exception as e:
                logger.error(f"Sync error: {e}")
            time.sleep(check_interval)

    def stop(self):
        self.running = False


if __name__ == "__main__":
    url = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_CONVEX_URL
    service = ConvexSyncService(convex_url=url)
    try:
        service.run_daemon(check_interval=10)
    except KeyboardInterrupt:
        pass

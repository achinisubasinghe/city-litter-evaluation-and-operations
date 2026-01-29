#!/usr/bin/env python3
"""
Antigravity Session Exporter
Packages the current Antigravity conversation database, brain artifacts,
transcripts, and metadata into a portable .tar.gz bundle that can be
imported on any computer running Antigravity.
"""

import os
import sys
import json
import sqlite3
import tarfile
import tempfile
import argparse
from pathlib import Path

CONVERSATION_ID = "96b553bc-91ce-40f7-b63b-467eb0506466"


def export_session(conversation_id: str, output_path: Path):
    home_dir = Path.home()
    app_data_dir = home_dir / ".gemini" / "antigravity"

    db_file = app_data_dir / "conversations" / f"{conversation_id}.db"
    brain_dir = app_data_dir / "brain" / conversation_id
    summary_db_file = app_data_dir / "conversation_summaries.db"

    if not db_file.exists():
        print(f"Error: Conversation DB not found at {db_file}")
        sys.exit(1)

    print(f"1. Checkpointing SQLite database to flush WAL: {db_file}...")
    conn = sqlite3.connect(db_file)
    conn.execute("PRAGMA wal_checkpoint(TRUNCATE);")
    conn.close()

    print("2. Extracting conversation metadata from conversation_summaries.db...")
    summary_record = None
    if summary_db_file.exists():
        conn = sqlite3.connect(summary_db_file)
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        cur.execute(
            "SELECT * FROM conversation_summaries WHERE conversation_id = ?",
            (conversation_id,)
        )
        row = cur.fetchone()
        if row:
            summary_record = dict(row)
            if summary_record.get("raw_summary") and isinstance(summary_record["raw_summary"], (bytes, bytearray)):
                summary_record["raw_summary_hex"] = summary_record["raw_summary"].hex()
                del summary_record["raw_summary"]
        conn.close()

    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp_path = Path(tmp_dir)

        metadata = {
            "conversation_id": conversation_id,
            "title": summary_record.get("title", "Trash Detection Model Plan") if summary_record else "Trash Detection Model Plan",
            "summary_record": summary_record
        }
        with open(tmp_path / "session_metadata.json", "w", encoding="utf-8") as f:
            json.dump(metadata, f, indent=2)

        print(f"3. Creating session archive at {output_path}...")
        with tarfile.open(output_path, "w:gz") as tar:
            tar.add(tmp_path / "session_metadata.json", arcname="session_metadata.json")
            tar.add(db_file, arcname=f"conversations/{conversation_id}.db")
            if brain_dir.exists():
                tar.add(brain_dir, arcname=f"brain/{conversation_id}")

    print(f"\nSession successfully exported to: {output_path}")
    print(f"Archive size: {output_path.stat().st_size / (1024 * 1024):.2f} MB")
    print("\nTo restore on another computer, run:")
    print(f"  python scripts/import_session.py {output_path}")


def main():
    parser = argparse.ArgumentParser(description="Export Antigravity Conversation Session")
    parser.add_argument(
        "--conversation-id",
        type=str,
        default=CONVERSATION_ID,
        help="Antigravity conversation ID to export"
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("antigravity_trash_session.tar.gz"),
        help="Output .tar.gz bundle path"
    )
    args = parser.parse_args()

    export_session(args.conversation_id, args.output)


if __name__ == "__main__":
    main()

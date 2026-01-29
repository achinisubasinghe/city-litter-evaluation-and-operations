#!/usr/bin/env python3
"""
Antigravity Session Importer
Unpacks an Antigravity conversation bundle and registers it with the local
Antigravity installation so it appears directly in the sidebar/history.
"""

import os
import sys
import json
import sqlite3
import tarfile
import argparse
from pathlib import Path


def import_session(bundle_path: Path):
    if not bundle_path.exists():
        print(f"Error: Bundle file not found at {bundle_path}")
        sys.exit(1)

    home_dir = Path.home()
    app_data_dir = home_dir / ".gemini" / "antigravity"
    conversations_dir = app_data_dir / "conversations"
    brain_dir = app_data_dir / "brain"
    summary_db_file = app_data_dir / "conversation_summaries.db"

    conversations_dir.mkdir(parents=True, exist_ok=True)
    brain_dir.mkdir(parents=True, exist_ok=True)

    print(f"1. Extracting archive: {bundle_path} to {app_data_dir}...")
    with tarfile.open(bundle_path, "r:gz") as tar:
        try:
            tar.extractall(path=app_data_dir, filter="data")
        except TypeError:
            tar.extractall(path=app_data_dir)

    metadata_path = app_data_dir / "session_metadata.json"
    if not metadata_path.exists():
        print("Warning: session_metadata.json not found in archive.")
        metadata = {}
    else:
        with open(metadata_path, "r", encoding="utf-8") as f:
            metadata = json.load(f)
        metadata_path.unlink()

    conversation_id = metadata.get("conversation_id")
    summary_record = metadata.get("summary_record")

    if conversation_id and summary_record:
        print(f"2. Registering conversation '{metadata.get('title')}' in conversation_summaries.db...")
        if "raw_summary_hex" in summary_record:
            summary_record["raw_summary"] = bytes.fromhex(summary_record["raw_summary_hex"])
            del summary_record["raw_summary_hex"]

        conn = sqlite3.connect(summary_db_file)
        cur = conn.cursor()

        cur.execute("""
        CREATE TABLE IF NOT EXISTS `conversation_summaries` (
            `conversation_id` text,
            `title` text NOT NULL DEFAULT "",
            `preview` text NOT NULL DEFAULT "",
            `step_count` integer NOT NULL DEFAULT 0,
            `last_modified_time` datetime NOT NULL,
            `workspace_uris` text NOT NULL,
            `status` text NOT NULL DEFAULT "",
            `source` text NOT NULL DEFAULT "",
            `project_id` text NOT NULL DEFAULT "",
            `agent_name` text NOT NULL DEFAULT "",
            `parent_conversation_id` text NOT NULL DEFAULT "",
            `nesting_depth` integer NOT NULL DEFAULT 0,
            `battle_id` text NOT NULL DEFAULT "",
            `winning_conversation_id` text NOT NULL DEFAULT "",
            `not_fully_idle` numeric NOT NULL DEFAULT false,
            `killed` numeric NOT NULL DEFAULT false,
            `last_user_input_time` datetime NOT NULL,
            `last_user_input_step_index` integer NOT NULL DEFAULT -1,
            `app_data_dir` text NOT NULL DEFAULT "",
            `raw_summary` blob,
            `group_id` text NOT NULL DEFAULT "",
            PRIMARY KEY (`conversation_id`)
        );
        """)

        cur.execute("DELETE FROM conversation_summaries WHERE conversation_id = ?", (conversation_id,))

        columns = list(summary_record.keys())
        placeholders = ", ".join(["?"] * len(columns))
        col_names = ", ".join([f"`{c}`" for c in columns])
        values = [summary_record[c] for c in columns]

        sql = f"INSERT INTO conversation_summaries ({col_names}) VALUES ({placeholders})"
        cur.execute(sql, values)
        conn.commit()
        conn.close()
        print("  Summary record updated successfully.")

    print("\nSession import complete!")
    print(f"  Conversation ID: {conversation_id}")
    print(f"  Database:        {conversations_dir / f'{conversation_id}.db'}")
    print(f"  Artifacts/Brain: {brain_dir / conversation_id}")
    print("\nPlease restart or refresh Antigravity to view the session in your sidebar.")


def main():
    parser = argparse.ArgumentParser(description="Import Antigravity Conversation Session")
    parser.add_argument(
        "bundle",
        type=Path,
        help="Path to the .tar.gz session archive to import"
    )
    args = parser.parse_args()

    import_session(args.bundle)


if __name__ == "__main__":
    main()

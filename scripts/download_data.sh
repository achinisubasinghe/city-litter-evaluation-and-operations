#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
KAGGLE_BIN="$PROJECT_ROOT/.venv/bin/kaggle"

if [ ! -f "$KAGGLE_BIN" ]; then
    KAGGLE_BIN="$(which kaggle 2>/dev/null || true)"
fi

if [ -z "$KAGGLE_BIN" ] || [ ! -x "$KAGGLE_BIN" ]; then
    echo "Error: kaggle CLI not found."
    exit 1
fi

DATA_DIR="$PROJECT_ROOT/data/raw"
INTEL_DIR="$DATA_DIR/intel"
TACO_DIR="$DATA_DIR/taco"

mkdir -p "$INTEL_DIR" "$TACO_DIR"

echo "=== Downloading Intel Image Classification (Negative Scenes) ==="
if [ -d "$INTEL_DIR/seg_train" ] || [ -d "$INTEL_DIR/seg_test" ]; then
    echo "Intel dataset already present in $INTEL_DIR, skipping download."
else
    "$KAGGLE_BIN" datasets download -d puneet6060/intel-image-classification -p "$INTEL_DIR" --unzip
    echo "Intel dataset downloaded and unzipped successfully."
fi

echo "=== Downloading TACO Trash Dataset (Positive Trash) ==="
if [ -d "$TACO_DIR/data" ] && [ -f "$TACO_DIR/data/annotations.json" ]; then
    echo "TACO dataset already present in $TACO_DIR, skipping download."
else
    "$KAGGLE_BIN" datasets download -d kneroma/tacotrashdataset -p "$TACO_DIR" --unzip
    echo "TACO dataset downloaded and unzipped successfully."
fi

echo "=== Data download complete! ==="

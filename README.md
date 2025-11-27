# MobileNetV2 Trash Presence Background Detector

End-to-end binary classification model and deployment pipeline built with **MobileNetV2** to detect whether an environmental background contains trash/litter or is clean.

Trained on:
- **TACO Dataset** (`kneroma/tacotrashdataset`): Contextual positive trash examples
- **Intel Image Classification** (`puneet6060/intel-image-classification`): Clean natural and urban landscapes

## Pipeline Overview

1. **High-Resolution Input**: Configured for `384x384` resolution for fine-grained litter detection.
2. **Balanced Sampling**: Intel landscape categories (`street`, `forest`, `buildings`, `sea`, `mountain`, `glacier`) are sampled evenly to match TACO positive image counts.
3. **Two-Stage Transfer Learning**:
   - Stage 1: Feature extractor frozen, training head classifier.
   - Stage 2: Differential fine-tuning across backbone and classifier.
4. **Export Formats**:
   - PyTorch Checkpoints (`.pth`)
   - ONNX (`.onnx` with embedded Sigmoid probability and dynamic batching)
   - TorchScript (`.pt`)
   - TypeScript Client (`typescript/`)

## Quickstart

### 1. Environment Setup
```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 2. Download Datasets (Kaggle CLI)
```bash
./scripts/download_data.sh
```

### 3. Build Balanced Dataset Splits
```bash
python src/dataset_builder.py
```

### 4. Train Model
```bash
python src/train.py --img-size 384 --epochs-warmup 3 --epochs-finetune 7 --batch-size 32
```

### 5. Evaluate on Test Split
```bash
python src/evaluate.py --checkpoint checkpoints/best_model.pth --manifest data/processed/dataset_manifest.csv
```

### 6. Export to ONNX (for TypeScript & Mobile)
```bash
python src/export.py --checkpoint checkpoints/best_model.pth --img-size 384
```

### 7. Run Inference
Python CLI:
```bash
python src/infer.py --model models/trash_classifier_384.onnx --image path/to/image.jpg
```

TypeScript:
```bash
cd typescript
npm install
npm run infer -- ../models/trash_classifier_384.onnx path/to/image.jpg
```

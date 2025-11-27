#!/usr/bin/env python3
"""
Inference CLI tool for Trash Presence Detection.
Supports both PyTorch (.pth) and ONNX (.onnx) formats.
"""

import sys
import json
import argparse
from pathlib import Path
from PIL import Image
import numpy as np
import torch
from torchvision import transforms

from model import build_model


def preprocess_pil(image: Image.Image, img_size: int = 384) -> torch.Tensor:
    transform = transforms.Compose([
        transforms.Resize((img_size, img_size)),
        transforms.ToTensor(),
        transforms.Normalize(
            mean=[0.485, 0.456, 0.406],
            std=[0.229, 0.224, 0.225]
        )
    ])
    tensor = transform(image.convert("RGB")).unsqueeze(0)
    return tensor


def predict_pytorch(model: torch.nn.Module, tensor: torch.Tensor, device) -> float:
    with torch.no_grad():
        tensor = tensor.to(device)
        logits = model(tensor)
        prob = torch.sigmoid(logits).item()
    return float(prob)


def predict_onnx(ort_session, tensor: torch.Tensor) -> float:
    input_name = ort_session.get_inputs()[0].name
    ort_inputs = {input_name: tensor.numpy()}
    out = ort_session.run(None, ort_inputs)[0]
    # out is already probability if exported via export.py
    prob = float(out[0])
    return prob


def run_inference(
    model_path: Path,
    image_paths: list,
    img_size: int = 384,
    threshold: float = 0.5
):
    is_onnx = model_path.suffix.lower() == ".onnx"

    if is_onnx:
        import onnxruntime as ort
        print(f"Loading ONNX model: {model_path}")
        session = ort.InferenceSession(str(model_path))
        predict_fn = lambda t: predict_onnx(session, t)
    else:
        print(f"Loading PyTorch checkpoint: {model_path}")
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        checkpoint = torch.load(model_path, map_location=device)
        model = build_model(pretrained=False).to(device)
        model.load_state_dict(checkpoint["model_state_dict"])
        model.eval()
        predict_fn = lambda t: predict_pytorch(model, t, device)

    results = []
    for img_p in image_paths:
        try:
            with Image.open(img_p) as img:
                tensor = preprocess_pil(img, img_size=img_size)

            prob = predict_fn(tensor)
            has_trash = prob >= threshold

            result = {
                "file": str(img_p),
                "has_trash": bool(has_trash),
                "trash_probability": round(prob, 4),
                "label": "trash" if has_trash else "clean"
            }
            results.append(result)
            print(f"[{result['label'].upper()}] {img_p.name} (P={result['trash_probability']:.4f})")
        except Exception as e:
            print(f"[ERROR] Failed to process {img_p}: {e}")

    return results


def main():
    parser = argparse.ArgumentParser(description="Run inference with Trash Classifier")
    parser.add_argument("--model", type=Path, required=True, help="Path to .pth or .onnx model")
    parser.add_argument("--image", type=Path, required=True, help="Path to image file or directory")
    parser.add_argument("--img-size", type=int, default=384)
    parser.add_argument("--threshold", type=float, default=0.5)
    parser.add_argument("--json", action="store_true", help="Output results in JSON format")
    args = parser.parse_args()

    if args.image.is_dir():
        image_files = sorted(
            list(args.image.glob("*.jpg")) +
            list(args.image.glob("*.jpeg")) +
            list(args.image.glob("*.png"))
        )
    else:
        image_files = [args.image]

    if not image_files:
        print("No valid images found.")
        sys.exit(1)

    results = run_inference(
        model_path=args.model,
        image_paths=image_files,
        img_size=args.img_size,
        threshold=args.threshold
    )

    if args.json:
        print(json.dumps(results, indent=2))


if __name__ == "__main__":
    main()

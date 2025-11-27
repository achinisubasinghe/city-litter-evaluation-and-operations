#!/usr/bin/env python3
"""
Model Export Pipeline for MobileNetV2 Trash Classifier.
Exports PyTorch weights to:
  1. ONNX (with dynamic batch size & integrated sigmoid for TypeScript runtime)
  2. TorchScript (.pt)
Validates parity between PyTorch and ONNX Runtime outputs.
"""

import argparse
from pathlib import Path
import numpy as np
import torch
import torch.nn as nn
import onnx
import onnxruntime as ort

from model import build_model


class DeployableModel(nn.Module):
    """
    Wraps model to output calibrated probability via Sigmoid directly,
    simplifying inference across TypeScript / ONNX runtimes.
    """
    def __init__(self, base_model: nn.Module):
        super().__init__()
        self.base_model = base_model

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        logits = self.base_model(x)
        probs = torch.sigmoid(logits)
        return probs


def export_model(
    checkpoint_path: Path,
    output_dir: Path,
    img_size: int = 384,
    opset_version: int = 18
):
    output_dir.mkdir(parents=True, exist_ok=True)
    device = torch.device("cpu")

    print(f"Loading checkpoint: {checkpoint_path}")
    checkpoint = torch.load(checkpoint_path, map_location=device)
    saved_size = checkpoint.get("img_size", img_size)

    base_model = build_model(pretrained=False).to(device)
    base_model.load_state_dict(checkpoint["model_state_dict"])
    base_model.eval()

    deploy_model = DeployableModel(base_model).to(device)
    deploy_model.eval()

    dummy_input = torch.randn(1, 3, saved_size, saved_size, dtype=torch.float32)

    # 1. Export ONNX
    onnx_path = output_dir / f"trash_classifier_{saved_size}.onnx"
    print(f"\nExporting ONNX model to {onnx_path} (Opset {opset_version})...")

    torch.onnx.export(
        deploy_model,
        dummy_input,
        str(onnx_path),
        export_params=True,
        opset_version=opset_version,
        do_constant_folding=True,
        input_names=["input"],
        output_names=["probability"],
        dynamic_axes={
            "input": {0: "batch_size"},
            "probability": {0: "batch_size"}
        }
    )

    # Verify ONNX model
    onnx_model = onnx.load(str(onnx_path))
    onnx.checker.check_model(onnx_model)
    print("  ONNX model validation passed successfully.")

    # 2. Export TorchScript
    ts_path = output_dir / f"trash_classifier_{saved_size}.pt"
    print(f"\nExporting TorchScript model to {ts_path}...")
    traced_model = torch.jit.trace(deploy_model, dummy_input)
    traced_model.save(str(ts_path))
    print("  TorchScript model saved successfully.")

    # 3. Numerical Parity Check: PyTorch vs ONNX Runtime
    print("\nVerifying numerical parity between PyTorch and ONNX Runtime...")
    with torch.no_grad():
        pytorch_out = deploy_model(dummy_input).numpy()

    ort_session = ort.InferenceSession(str(onnx_path))
    ort_inputs = {ort_session.get_inputs()[0].name: dummy_input.numpy()}
    ort_out = ort_session.run(None, ort_inputs)[0]

    max_diff = np.max(np.abs(pytorch_out - ort_out))
    print(f"  Maximum absolute difference: {max_diff:.6e}")
    assert max_diff < 1e-4, f"Parity check failed: max difference {max_diff} exceeded tolerance."
    print("  Parity check PASSED! PyTorch and ONNX outputs are virtually identical.")

    print(f"\nExport complete! Artifacts available in {output_dir}:")
    print(f"  - ONNX:        {onnx_path} (Size: {onnx_path.stat().st_size / (1024*1024):.2f} MB)")
    print(f"  - TorchScript: {ts_path} (Size: {ts_path.stat().st_size / (1024*1024):.2f} MB)")


def main():
    parser = argparse.ArgumentParser(description="Export MobileNetV2 Trash Classifier")
    parser.add_argument("--checkpoint", type=Path, default=Path("checkpoints/best_model.pth"))
    parser.add_argument("--output-dir", type=Path, default=Path("models"))
    parser.add_argument("--img-size", type=int, default=384)
    parser.add_argument("--opset", type=int, default=18)
    args = parser.parse_args()

    export_model(
        checkpoint_path=args.checkpoint,
        output_dir=args.output_dir,
        img_size=args.img_size,
        opset_version=args.opset
    )


if __name__ == "__main__":
    main()

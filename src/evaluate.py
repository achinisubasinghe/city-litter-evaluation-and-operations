#!/usr/bin/env python3
"""
Evaluation Script for MobileNetV2 Trash Classifier.
Evaluates on test split, generates classification metrics, and plots confusion matrix.
"""

import json
import argparse
from pathlib import Path
import numpy as np
import matplotlib.pyplot as plt
import torch
import torch.nn as nn
from sklearn.metrics import (
    accuracy_score,
    precision_recall_fscore_support,
    roc_auc_score,
    confusion_matrix,
    classification_report
)

from model import build_model
from dataset import get_dataloaders


def evaluate_test_set(
    checkpoint_path: Path,
    manifest_path: Path,
    output_dir: Path,
    img_size: int = 384,
    device_str: str = ""
):
    output_dir.mkdir(parents=True, exist_ok=True)

    if device_str:
        device = torch.device(device_str)
    else:
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    print(f"Loading checkpoint: {checkpoint_path}")
    checkpoint = torch.load(checkpoint_path, map_location=device)
    saved_size = checkpoint.get("img_size", img_size)

    model = build_model(pretrained=False).to(device)
    model.load_state_dict(checkpoint["model_state_dict"])
    model.eval()

    print(f"Loading test split from {manifest_path} (Resolution: {saved_size}x{saved_size})...")
    loaders = get_dataloaders(manifest_path, batch_size=32, num_workers=2, img_size=saved_size)
    test_loader = loaders["test"]

    all_preds = []
    all_targets = []
    all_probs = []

    with torch.no_grad():
        for images, labels in test_loader:
            images = images.to(device)
            logits = model(images)
            probs = torch.sigmoid(logits)
            preds = (probs >= 0.5).float()

            all_probs.extend(probs.cpu().numpy().tolist())
            all_preds.extend(preds.cpu().numpy().tolist())
            all_targets.extend(labels.numpy().tolist())

    all_preds = np.array(all_preds)
    all_targets = np.array(all_targets)
    all_probs = np.array(all_probs)

    acc = float(accuracy_score(all_targets, all_preds))
    prec, rec, f1, _ = precision_recall_fscore_support(all_targets, all_preds, average="binary")
    try:
        auc = float(roc_auc_score(all_targets, all_probs))
    except Exception:
        auc = 0.5

    cm = confusion_matrix(all_targets, all_preds).tolist()
    clf_rep = classification_report(
        all_targets, all_preds, target_names=["Clean (0)", "Trash (1)"], output_dict=True
    )

    results = {
        "checkpoint": str(checkpoint_path),
        "test_samples": len(all_targets),
        "accuracy": acc,
        "precision": float(prec),
        "recall": float(rec),
        "f1_score": float(f1),
        "roc_auc": auc,
        "confusion_matrix": {
            "true_clean_pred_clean (TN)": cm[0][0],
            "true_clean_pred_trash (FP)": cm[0][1],
            "true_trash_pred_clean (FN)": cm[1][0],
            "true_trash_pred_trash (TP)": cm[1][1]
        },
        "classification_report": clf_rep
    }

    report_path = output_dir / "evaluation_report.json"
    with open(report_path, "w") as f:
        json.dump(results, f, indent=2)
    print(f"\nSaved evaluation metrics report to {report_path}")

    # Plot Confusion Matrix
    cm_arr = np.array(cm)
    plt.figure(figsize=(6, 5))
    plt.imshow(cm_arr, interpolation="nearest", cmap=plt.cm.Blues)
    plt.title("Confusion Matrix: Trash Detection")
    plt.colorbar()
    tick_marks = np.arange(2)
    plt.xticks(tick_marks, ["Clean (0)", "Trash (1)"])
    plt.yticks(tick_marks, ["Clean (0)", "Trash (1)"])

    thresh = cm_arr.max() / 2.0
    for i in range(2):
        for j in range(2):
            plt.text(
                j, i, format(cm_arr[i, j], "d"),
                horizontalalignment="center",
                color="white" if cm_arr[i, j] > thresh else "black",
                fontsize=14
            )

    plt.ylabel("True Label")
    plt.xlabel("Predicted Label")
    plt.tight_layout()

    cm_path = output_dir / "confusion_matrix.png"
    plt.savefig(cm_path, dpi=150)
    plt.close()
    print(f"Confusion matrix plot saved to {cm_path}")

    print("\n=== Final Test Results ===")
    print(f"Accuracy:  {acc * 100:.2f}%")
    print(f"Precision: {prec * 100:.2f}%")
    print(f"Recall:    {rec * 100:.2f}%")
    print(f"F1-Score:  {f1 * 100:.2f}%")
    print(f"ROC-AUC:   {auc:.4f}")


def main():
    parser = argparse.ArgumentParser(description="Evaluate Trash Classifier")
    parser.add_argument("--checkpoint", type=Path, default=Path("checkpoints/best_model.pth"))
    parser.add_argument("--manifest", type=Path, default=Path("data/processed/dataset_manifest.csv"))
    parser.add_argument("--output-dir", type=Path, default=Path("evaluation"))
    parser.add_argument("--img-size", type=int, default=384)
    parser.add_argument("--device", type=str, default="")
    args = parser.parse_args()

    evaluate_test_set(
        checkpoint_path=args.checkpoint,
        manifest_path=args.manifest,
        output_dir=args.output_dir,
        img_size=args.img_size,
        device_str=args.device
    )


if __name__ == "__main__":
    main()

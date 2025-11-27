#!/usr/bin/env python3
"""
Training Pipeline for MobileNetV2 Trash Background Classifier.
Implements Two-Stage Transfer Learning:
  Stage 1: Frozen backbone, train classification head.
  Stage 2: Differential fine-tuning of backbone and head.
"""

import os
import sys
import json
import argparse
from pathlib import Path
import numpy as np
import matplotlib.pyplot as plt
import torch
import torch.nn as nn
from torch.optim import AdamW
from torch.optim.lr_scheduler import CosineAnnealingLR
from sklearn.metrics import accuracy_score, precision_recall_fscore_support, roc_auc_score
from tqdm import tqdm

from model import build_model
from dataset import get_dataloaders


def evaluate(model: nn.Module, loader, criterion, device) -> dict:
    model.eval()
    total_loss = 0.0
    all_preds = []
    all_targets = []
    all_probs = []

    with torch.no_grad():
        for images, labels in loader:
            images = images.to(device)
            labels = labels.to(device)

            logits = model(images)
            loss = criterion(logits, labels)
            total_loss += loss.item() * len(labels)

            probs = torch.sigmoid(logits)
            preds = (probs >= 0.5).float()

            all_probs.extend(probs.cpu().numpy().tolist())
            all_preds.extend(preds.cpu().numpy().tolist())
            all_targets.extend(labels.cpu().numpy().tolist())

    n_samples = len(all_targets)
    avg_loss = total_loss / n_samples
    acc = accuracy_score(all_targets, all_preds)
    precision, recall, f1, _ = precision_recall_fscore_support(
        all_targets, all_preds, average="binary", zero_division=0
    )
    try:
        auc = roc_auc_score(all_targets, all_probs)
    except Exception:
        auc = 0.5

    return {
        "loss": avg_loss,
        "accuracy": acc,
        "precision": precision,
        "recall": recall,
        "f1": f1,
        "auc": auc
    }


def train_epoch(model: nn.Module, loader, optimizer, criterion, device) -> float:
    model.train()
    total_loss = 0.0
    n_samples = 0

    pbar = tqdm(loader, desc="Training", leave=False)
    for images, labels in pbar:
        images = images.to(device)
        labels = labels.to(device)

        optimizer.zero_grad()
        logits = model(images)
        loss = criterion(logits, labels)
        loss.backward()
        optimizer.step()

        batch_sz = len(labels)
        total_loss += loss.item() * batch_sz
        n_samples += batch_sz
        pbar.set_postfix({"loss": f"{loss.item():.4f}"})

    return total_loss / n_samples


def main():
    parser = argparse.ArgumentParser(description="Train MobileNetV2 Trash Classifier")
    parser.add_argument("--manifest", type=Path, default=Path("data/processed/dataset_manifest.csv"))
    parser.add_argument("--epochs-warmup", type=int, default=3, help="Stage 1 warmup epochs")
    parser.add_argument("--epochs-finetune", type=int, default=7, help="Stage 2 fine-tuning epochs")
    parser.add_argument("--batch-size", type=int, default=32)
    parser.add_argument("--img-size", type=int, default=384, help="Resolution (384 for high-res)")
    parser.add_argument("--lr-head", type=float, default=1e-3)
    parser.add_argument("--lr-backbone", type=float, default=1e-4)
    parser.add_argument("--num-workers", type=int, default=4)
    parser.add_argument("--output-dir", type=Path, default=Path("checkpoints"))
    parser.add_argument("--device", type=str, default="")
    args = parser.parse_args()

    args.output_dir.mkdir(parents=True, exist_ok=True)

    if args.device:
        device = torch.device(args.device)
    else:
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Using compute device: {device}")

    # Limit CPU threads if running on CPU to prevent thrashing
    if device.type == "cpu":
        torch.set_num_threads(min(8, os.cpu_count() or 4))

    print(f"Loading data from {args.manifest} at {args.img_size}x{args.img_size}...")
    loaders = get_dataloaders(
        args.manifest,
        batch_size=args.batch_size,
        num_workers=args.num_workers,
        img_size=args.img_size
    )

    print("Instantiating MobileNetV2 model...")
    model = build_model(pretrained=True, dropout=0.2).to(device)

    # Calculate class weights for pos_weight in BCE
    train_df = loaders["train"].dataset.df
    n_pos = (train_df["label"] == 1).sum()
    n_neg = (train_df["label"] == 0).sum()
    pos_weight = torch.tensor([n_neg / max(1, n_pos)], dtype=torch.float32).to(device)
    print(f"Dataset stats: {n_pos} trash images, {n_neg} clean images. Pos weight: {pos_weight.item():.3f}")

    criterion = nn.BCEWithLogitsLoss(pos_weight=pos_weight)

    history = {
        "epoch": [],
        "train_loss": [],
        "val_loss": [],
        "val_accuracy": [],
        "val_precision": [],
        "val_recall": [],
        "val_f1": [],
        "val_auc": []
    }

    best_val_f1 = -1.0
    best_ckpt_path = args.output_dir / "best_model.pth"

    total_epochs = args.epochs_warmup + args.epochs_finetune
    current_epoch = 0

    # ---------------- STAGE 1: WARMUP (FROZEN BACKBONE) ----------------
    if args.epochs_warmup > 0:
        print(f"\n=== Stage 1: Classifier Warmup ({args.epochs_warmup} epochs, backbone frozen) ===")
        model.freeze_backbone()
        optimizer = AdamW(
            [p for p in model.parameters() if p.requires_grad],
            lr=args.lr_head,
            weight_decay=1e-4
        )
        scheduler = CosineAnnealingLR(optimizer, T_max=args.epochs_warmup)

        for ep in range(1, args.epochs_warmup + 1):
            current_epoch += 1
            train_loss = train_epoch(model, loaders["train"], optimizer, criterion, device)
            val_metrics = evaluate(model, loaders["val"], criterion, device)
            scheduler.step()

            history["epoch"].append(current_epoch)
            history["train_loss"].append(train_loss)
            history["val_loss"].append(val_metrics["loss"])
            history["val_accuracy"].append(val_metrics["accuracy"])
            history["val_precision"].append(val_metrics["precision"])
            history["val_recall"].append(val_metrics["recall"])
            history["val_f1"].append(val_metrics["f1"])
            history["val_auc"].append(val_metrics["auc"])

            print(
                f"[Stage 1 Epoch {ep}/{args.epochs_warmup}] "
                f"Train Loss: {train_loss:.4f} | Val Loss: {val_metrics['loss']:.4f} | "
                f"Val Acc: {val_metrics['accuracy']:.4f} | Val F1: {val_metrics['f1']:.4f}"
            )

            if val_metrics["f1"] > best_val_f1:
                best_val_f1 = val_metrics["f1"]
                torch.save({
                    "epoch": current_epoch,
                    "model_state_dict": model.state_dict(),
                    "val_f1": best_val_f1,
                    "img_size": args.img_size
                }, best_ckpt_path)
                print(f"  * Saved new best model checkpoint to {best_ckpt_path} (F1: {best_val_f1:.4f})")

    # ---------------- STAGE 2: FINE-TUNING (UNFROZEN BACKBONE) ----------------
    if args.epochs_finetune > 0:
        print(f"\n=== Stage 2: Fine-Tuning ({args.epochs_finetune} epochs, backbone unfrozen) ===")
        model.unfreeze_backbone()
        param_groups = model.get_parameter_groups(
            head_lr=args.lr_head * 0.5,
            backbone_lr=args.lr_backbone
        )
        optimizer = AdamW(param_groups, weight_decay=1e-4)
        scheduler = CosineAnnealingLR(optimizer, T_max=args.epochs_finetune)

        for ep in range(1, args.epochs_finetune + 1):
            current_epoch += 1
            train_loss = train_epoch(model, loaders["train"], optimizer, criterion, device)
            val_metrics = evaluate(model, loaders["val"], criterion, device)
            scheduler.step()

            history["epoch"].append(current_epoch)
            history["train_loss"].append(train_loss)
            history["val_loss"].append(val_metrics["loss"])
            history["val_accuracy"].append(val_metrics["accuracy"])
            history["val_precision"].append(val_metrics["precision"])
            history["val_recall"].append(val_metrics["recall"])
            history["val_f1"].append(val_metrics["f1"])
            history["val_auc"].append(val_metrics["auc"])

            print(
                f"[Stage 2 Epoch {ep}/{args.epochs_finetune}] "
                f"Train Loss: {train_loss:.4f} | Val Loss: {val_metrics['loss']:.4f} | "
                f"Val Acc: {val_metrics['accuracy']:.4f} | Val F1: {val_metrics['f1']:.4f}"
            )

            if val_metrics["f1"] > best_val_f1:
                best_val_f1 = val_metrics["f1"]
                torch.save({
                    "epoch": current_epoch,
                    "model_state_dict": model.state_dict(),
                    "val_f1": best_val_f1,
                    "img_size": args.img_size
                }, best_ckpt_path)
                print(f"  * Saved new best model checkpoint to {best_ckpt_path} (F1: {best_val_f1:.4f})")

    # Save training history JSON
    history_file = args.output_dir / "training_history.json"
    with open(history_file, "w") as f:
        json.dump(history, f, indent=2)
    print(f"\nTraining history written to {history_file}")

    # Plot learning curves
    plt.figure(figsize=(12, 5))

    plt.subplot(1, 2, 1)
    plt.plot(history["epoch"], history["train_loss"], label="Train Loss", marker="o")
    plt.plot(history["epoch"], history["val_loss"], label="Val Loss", marker="s")
    plt.xlabel("Epoch")
    plt.ylabel("Loss")
    plt.title("Training and Validation Loss")
    plt.grid(True, linestyle="--", alpha=0.6)
    plt.legend()

    plt.subplot(1, 2, 2)
    plt.plot(history["epoch"], history["val_accuracy"], label="Val Accuracy", marker="o", color="green")
    plt.plot(history["epoch"], history["val_f1"], label="Val F1", marker="^", color="purple")
    plt.xlabel("Epoch")
    plt.ylabel("Score")
    plt.title("Validation Accuracy & F1-Score")
    plt.grid(True, linestyle="--", alpha=0.6)
    plt.legend()

    plt.tight_layout()
    plot_file = args.output_dir / "learning_curves.png"
    plt.savefig(plot_file, dpi=150)
    plt.close()
    print(f"Learning curves plot saved to {plot_file}")
    print(f"Best validation F1: {best_val_f1:.4f}")


if __name__ == "__main__":
    main()

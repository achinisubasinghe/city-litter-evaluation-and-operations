#!/usr/bin/env python3
"""
Dataset Builder for Trash vs. Clean Background Classification.
Parses TACO dataset (Trash = 1) and Intel Image Classification (Clean = 0),
balances the classes, and generates stratified train/val/test splits.
"""

import os
import json
import random
import argparse
import pandas as pd
from pathlib import Path
from typing import List, Dict, Tuple


def find_taco_images(taco_dir: Path) -> List[Path]:
    """Finds all valid trash-containing images in TACO dataset."""
    ann_path = taco_dir / "data" / "annotations.json"
    if not ann_path.exists():
        # Fallback to search any annotations.json in taco_dir
        found = list(taco_dir.glob("**/annotations.json"))
        if not found:
            raise FileNotFoundError(f"Could not find annotations.json in {taco_dir}")
        ann_path = found[0]

    with open(ann_path, "r", encoding="utf-8") as f:
        coco_data = json.load(f)

    # Images with at least one annotation
    annotated_img_ids = {ann["image_id"] for ann in coco_data.get("annotations", [])}

    base_dir = ann_path.parent
    taco_images = []
    for img_info in coco_data.get("images", []):
        if img_info["id"] in annotated_img_ids:
            rel_file = img_info["file_name"]
            img_path = base_dir / rel_file
            if img_path.exists():
                taco_images.append(img_path.resolve())

    # Fallback if annotations.json didn't match paths: gather any .jpg in batch_* folders
    if len(taco_images) == 0:
        for p in taco_dir.glob("**/batch_*/*.jpg"):
            taco_images.append(p.resolve())

    print(f"Found {len(taco_images)} valid TACO trash images.")
    return sorted(list(set(taco_images)))


def find_intel_images(intel_dir: Path, target_count: int, seed: int = 42) -> List[Path]:
    """Finds and samples clean background images from Intel Image Classification."""
    categories = ["buildings", "forest", "glacier", "mountain", "sea", "street"]
    cat_images: Dict[str, List[Path]] = {cat: [] for cat in categories}

    for cat in categories:
        # Search in seg_train, seg_test, or any subfolder with the category name
        found = list(intel_dir.glob(f"**/{cat}/*.jpg")) + list(intel_dir.glob(f"**/{cat}/*.jpeg"))
        cat_images[cat] = [p.resolve() for p in found]
        print(f"  Intel category '{cat}': found {len(cat_images[cat])} images.")

    # Evenly sample from each category to reach target_count
    rng = random.Random(seed)
    sampled_images = []
    per_cat_target = target_count // len(categories)
    remainder = target_count % len(categories)

    for i, cat in enumerate(categories):
        quota = per_cat_target + (1 if i < remainder else 0)
        available = cat_images[cat]
        if len(available) <= quota:
            sampled_images.extend(available)
        else:
            sampled_images.extend(rng.sample(available, quota))

    print(f"Sampled {len(sampled_images)} clean images from Intel dataset.")
    return sampled_images


def build_dataset(
    taco_dir: Path,
    intel_dir: Path,
    output_dir: Path,
    train_ratio: float = 0.8,
    val_ratio: float = 0.1,
    test_ratio: float = 0.1,
    seed: int = 42,
    create_symlinks: bool = True
):
    assert abs((train_ratio + val_ratio + test_ratio) - 1.0) < 1e-5, "Ratios must sum to 1.0"
    rng = random.Random(seed)

    print("Step 1: Locating TACO trash images...")
    trash_images = find_taco_images(taco_dir)
    num_trash = len(trash_images)
    if num_trash == 0:
        raise RuntimeError("No TACO images found. Please verify data download.")

    print(f"\nStep 2: Sampling {num_trash} clean background images from Intel scenes...")
    clean_images = find_intel_images(intel_dir, target_count=num_trash, seed=seed)

    # Shuffle each class
    rng.shuffle(trash_images)
    rng.shuffle(clean_images)

    def split_data(images: List[Path]):
        n = len(images)
        n_train = int(n * train_ratio)
        n_val = int(n * val_ratio)
        return (
            images[:n_train],
            images[n_train:n_train + n_val],
            images[n_train + n_val:]
        )

    trash_train, trash_val, trash_test = split_data(trash_images)
    clean_train, clean_val, clean_test = split_data(clean_images)

    records = []
    splits = [
        ("train", trash_train, 1, "trash", "taco"),
        ("train", clean_train, 0, "clean", "intel"),
        ("val", trash_val, 1, "trash", "taco"),
        ("val", clean_val, 0, "clean", "intel"),
        ("test", trash_test, 1, "trash", "taco"),
        ("test", clean_test, 0, "clean", "intel"),
    ]

    output_dir.mkdir(parents=True, exist_ok=True)

    for split_name, img_list, label, class_name, source in splits:
        split_class_dir = output_dir / split_name / class_name
        if create_symlinks:
            split_class_dir.mkdir(parents=True, exist_ok=True)

        for idx, src_path in enumerate(img_list):
            rel_symlink_name = f"{source}_{src_path.stem}_{idx:05d}{src_path.suffix}"
            symlink_dest = split_class_dir / rel_symlink_name

            if create_symlinks:
                if symlink_dest.exists() or symlink_dest.is_symlink():
                    symlink_dest.unlink()
                symlink_dest.symlink_to(src_path)

            records.append({
                "filepath": str(src_path),
                "symlink_path": str(symlink_dest) if create_symlinks else "",
                "label": label,
                "class_name": class_name,
                "split": split_name,
                "source": source
            })

    df = pd.DataFrame(records)
    manifest_csv = output_dir / "dataset_manifest.csv"
    df.to_csv(manifest_csv, index=False)

    print("\n=== Dataset Generation Summary ===")
    print(f"Total Images: {len(df)}")
    summary = df.groupby(["split", "class_name"]).size().unstack(fill_value=0)
    print(summary)
    print(f"\nManifest saved to: {manifest_csv}")
    print(f"Processed dataset structure ready at: {output_dir}")


def main():
    parser = argparse.ArgumentParser(description="Build balanced Trash vs Clean dataset")
    parser.add_argument("--taco-dir", type=Path, default=Path("data/raw/taco"), help="Path to raw TACO dataset")
    parser.add_argument("--intel-dir", type=Path, default=Path("data/raw/intel"), help="Path to raw Intel dataset")
    parser.add_argument("--output-dir", type=Path, default=Path("data/processed"), help="Output processed data directory")
    parser.add_argument("--seed", type=int, default=42, help="Random seed")
    parser.add_argument("--no-symlinks", action="store_true", help="Do not create folder symlinks")

    args = parser.parse_args()
    build_dataset(
        taco_dir=args.taco_dir,
        intel_dir=args.intel_dir,
        output_dir=args.output_dir,
        seed=args.seed,
        create_symlinks=not args.no_symlinks
    )


if __name__ == "__main__":
    main()

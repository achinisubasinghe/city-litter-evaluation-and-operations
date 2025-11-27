#!/usr/bin/env python3
"""
Unit tests for MobileNetV2 Trash Classifier pipeline components.
"""

import sys
from pathlib import Path
import torch

# Add src to sys.path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from model import build_model, TrashClassifierMobileNetV2
from dataset import get_transforms


def test_model_architecture():
    model = build_model(pretrained=False)
    assert isinstance(model, TrashClassifierMobileNetV2)

    # Test forward pass with high-resolution 384x384
    batch_size = 2
    dummy_input = torch.randn(batch_size, 3, 384, 384)
    output = model(dummy_input)

    assert output.shape == (batch_size,), f"Expected shape ({batch_size},), got {output.shape}"


def test_model_freeze_unfreeze():
    model = build_model(pretrained=False)

    # Test freeze
    model.freeze_backbone()
    for param in model.backbone.features.parameters():
        assert not param.requires_grad

    for param in model.backbone.classifier.parameters():
        assert param.requires_grad

    # Test unfreeze
    model.unfreeze_backbone()
    for param in model.backbone.features.parameters():
        assert param.requires_grad


def test_transforms_shapes():
    train_transform = get_transforms(img_size=384, is_train=True)
    val_transform = get_transforms(img_size=384, is_train=False)

    from PIL import Image
    dummy_img = Image.new("RGB", (640, 480), color=(100, 150, 200))

    tensor_train = train_transform(dummy_img)
    tensor_val = val_transform(dummy_img)

    assert tensor_train.shape == (3, 384, 384)
    assert tensor_val.shape == (3, 384, 384)
    assert tensor_train.dtype == torch.float32


if __name__ == "__main__":
    print("Running tests...")
    test_model_architecture()
    print("test_model_architecture: PASS")
    test_model_freeze_unfreeze()
    print("test_model_freeze_unfreeze: PASS")
    test_transforms_shapes()
    print("test_transforms_shapes: PASS")
    print("All unit tests passed successfully!")

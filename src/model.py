import torch
import torch.nn as nn
from torchvision import models
from torchvision.models import MobileNet_V2_Weights


class TrashClassifierMobileNetV2(nn.Module):
    """
    MobileNetV2 model adapted for binary classification:
    Clean Background (0) vs. Contains Trash (1).
    Input image resolution: 384x384 (or arbitrary due to adaptive pooling).
    """
    def __init__(self, pretrained: bool = True, dropout: float = 0.2):
        super().__init__()
        weights = MobileNet_V2_Weights.DEFAULT if pretrained else None
        self.backbone = models.mobilenet_v2(weights=weights)

        # In MobileNetV2, features ends with an AdaptiveAvgPool2d((1, 1))
        # backbone.last_channel is typically 1280
        in_features = self.backbone.last_channel

        self.backbone.classifier = nn.Sequential(
            nn.Dropout(p=dropout),
            nn.Linear(in_features, 1)  # Single logit output for binary classification
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # Output shape: [batch_size, 1] -> squeeze to [batch_size]
        logits = self.backbone(x)
        return logits.view(-1)

    def freeze_backbone(self):
        """Freezes all feature extractor parameters for initial warm-up."""
        for param in self.backbone.features.parameters():
            param.requires_grad = False

    def unfreeze_backbone(self, unfreeze_last_n_blocks: int = None):
        """
        Unfreezes backbone for fine-tuning.
        If unfreeze_last_n_blocks is None, unfreezes all layers.
        """
        if unfreeze_last_n_blocks is None:
            for param in self.backbone.features.parameters():
                param.requires_grad = True
        else:
            total_blocks = len(self.backbone.features)
            cutoff = max(0, total_blocks - unfreeze_last_n_blocks)
            for idx, child in enumerate(self.backbone.features):
                requires_grad = (idx >= cutoff)
                for param in child.parameters():
                    param.requires_grad = requires_grad

    def get_parameter_groups(self, head_lr: float, backbone_lr: float):
        """Returns parameter groups with differential learning rates for fine-tuning."""
        backbone_params = [p for p in self.backbone.features.parameters() if p.requires_grad]
        head_params = [p for p in self.backbone.classifier.parameters() if p.requires_grad]

        return [
            {"params": backbone_params, "lr": backbone_lr},
            {"params": head_params, "lr": head_lr}
        ]


def build_model(pretrained: bool = True, dropout: float = 0.2) -> TrashClassifierMobileNetV2:
    return TrashClassifierMobileNetV2(pretrained=pretrained, dropout=dropout)

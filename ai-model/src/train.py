"""
train.py — Fine-tunes YOLOv8n-Seg for SAR Oil Spill Detection
==============================================================

Hardware  : NVIDIA RTX 4060 Laptop GPU (CUDA)
Model     : YOLOv8n-seg  (Nano — fastest convergence, smallest footprint)
Input     : 416 × 416 tiles (matches Dev 1 pipeline output)
Precision : AMP (Automatic Mixed Precision) — halves VRAM usage on RTX 4060
Output    : ai-model/weight/best.pt  (ready for inference.py + vectorization.py)

Run:
    python src/train.py
"""

import sys
import shutil
from pathlib import Path
from ultralytics import YOLO

# ─── Paths ────────────────────────────────────────────────────────────────────
AI_MODEL_DIR = Path(__file__).resolve().parent.parent
YAML_PATH    = AI_MODEL_DIR / "dataset.yaml"
WEIGHTS_DIR  = AI_MODEL_DIR / "weight"
OUTPUTS_DIR  = AI_MODEL_DIR / "outputs"

# ─── Hyperparameters ──────────────────────────────────────────────────────────
EPOCHS      = 50       # 50 is the sweet spot for this dataset size
IMGSZ       = 416      # Must match Dev 1 tile size exactly
BATCH       = 16       # Safe for RTX 4060 8GB VRAM with AMP
PATIENCE    = 15       # Stop early if no improvement for 15 epochs
DEVICE      = "0"      # GPU 0 (your RTX 4060); set "cpu" if CUDA breaks


def train():
    print("=" * 65)
    print("🛰️   SAR Oil Spill — YOLOv8n-Seg Training")
    print(f"📄  Dataset  : {YAML_PATH}")
    print(f"🖼️   Tile size: {IMGSZ} × {IMGSZ}")
    print(f"⚡  Device   : RTX 4060 GPU  |  AMP: ON  |  Batch: {BATCH}")
    print(f"🔁  Epochs   : {EPOCHS}  (early stop patience: {PATIENCE})")
    print("=" * 65)

    # Sanity check
    if not YAML_PATH.exists():
        print(f"\n❌  dataset.yaml not found at {YAML_PATH}")
        print("    Run:  python src/prepare_dataset.py  first.\n")
        sys.exit(1)

    WEIGHTS_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)

    # ── Load YOLOv8-Nano Segmentation backbone ─────────────────────────────────
    # yolov8n-seg.pt is auto-downloaded from Ultralytics on first run (~6 MB)
    print("\n📦  Loading YOLOv8n-seg backbone...")
    model = YOLO("yolov8n-seg.pt")

    # ── Train ──────────────────────────────────────────────────────────────────
    print("\n🚀  Starting training...\n")
    model.train(
        data       = str(YAML_PATH),
        epochs     = EPOCHS,
        imgsz      = IMGSZ,
        batch      = BATCH,
        device     = DEVICE,
        patience   = PATIENCE,
        amp        = True,           # Mixed precision → halves VRAM usage
        project    = str(OUTPUTS_DIR),
        name       = "oil_spill_v1",
        exist_ok   = True,

        # ── Optimiser ──────────────────────────────────────────────────────────
        optimizer  = "AdamW",
        lr0        = 0.001,          # Initial learning rate
        lrf        = 0.01,           # Final LR = lr0 × lrf
        warmup_epochs = 3,           # Gradual LR warmup prevents early instability

        # ── Class imbalance handling ───────────────────────────────────────────
        # Oil slick is rare → upweight positive-class losses
        cls        = 1.5,            # Classification loss weight (default 0.5)

        # ── SAR-appropriate augmentations ──────────────────────────────────────
        # Ocean scenes are rotationally symmetric — all flips are valid
        mosaic     = 1.0,            # Mosaic: combines 4 tiles → exposes model to more contexts
        flipud     = 0.5,            # Vertical flip (SAR is view-angle invariant)
        fliplr     = 0.5,            # Horizontal flip
        degrees    = 30.0,           # Rotation (oil slicks appear at any orientation)
        scale      = 0.3,            # Scale jitter
        hsv_s      = 0.0,            # No saturation shift (SAR is grayscale)
        hsv_h      = 0.0,            # No hue shift (SAR is grayscale)
        hsv_v      = 0.3,            # Slight brightness variation (simulates different pass times)

        workers    = 4,
        verbose    = True,
        plots      = True,           # Saves training curves to outputs/oil_spill_v1/
    )

    # ── Copy best weights to weight/best.pt ───────────────────────────────────
    best_src = OUTPUTS_DIR / "oil_spill_v1" / "weights" / "best.pt"
    best_dst = WEIGHTS_DIR / "best.pt"

    if best_src.exists():
        shutil.copy2(best_src, best_dst)
        print("\n" + "=" * 65)
        print("🎉  Training Complete!")
        print(f"🏆  Best weights → {best_dst}")
        print(f"📊  Metrics & plots → {OUTPUTS_DIR / 'oil_spill_v1'}")
        print("\n▶   Next: python src/inference.py")
        print("=" * 65)
    else:
        print("\n⚠️   Training done but best.pt not found at expected path.")
        print(f"     Check manually: {OUTPUTS_DIR / 'oil_spill_v1' / 'weights'}")


if __name__ == "__main__":
    train()


"""
prepare_dataset.py - Converts raw Sentinel-1 SAR Oil Spill dataset into YOLOv8-Seg format.

Workflow:
1. Scans Class_1 (Oil Slick) and Class_0 (No Oil / Background) images from data/raw/
2. For Class_1:
   - Applies Gaussian blur + Inverted Otsu thresholding (oil = dark patches in SAR)
   - Morphological opening to remove speckle noise
   - Extracts contour polygons using cv2.findContours
   - Normalizes (x, y) pixel coords to [0.0, 1.0]
   - Writes YOLO seg format: 0 x1 y1 x2 y2 ...
3. For Class_0:
   - Copies as background negatives (no label file = background in YOLO)
4. Splits 80% train / 20% val
5. Generates dataset.yaml
"""

import sys
import shutil
import random
import cv2
import numpy as np
from pathlib import Path

# ─── Paths ────────────────────────────────────────────────────────────────────
AI_MODEL_DIR = Path(__file__).resolve().parent.parent
RAW_DIR      = AI_MODEL_DIR / "data" / "raw"
DATA_DIR     = AI_MODEL_DIR / "data"
IMAGES_DIR   = DATA_DIR / "images"
LABELS_DIR   = DATA_DIR / "labels"
YAML_PATH    = AI_MODEL_DIR / "dataset.yaml"


# ─── Contour Extraction ───────────────────────────────────────────────────────

def extract_contours(img_path: Path, min_area: float = 1500.0, max_area_ratio: float = 0.80):
    """
    Reads a SAR grayscale image and returns a list of YOLO-seg polygon strings.

    SAR physics:
        Oil slicks flatten capillary waves → lower radar backscatter → DARKER pixels.
        Inverted Otsu thresholding isolates these dark regions as white blobs.

    Filters applied:
        - min_area=500      : removes radar speckle noise (was 120, too loose)
        - min_area=800      : removes radar speckle noise (400x400 px → 800 ~ 0.5% of frame)
        - max_area_ratio    : rejects full-frame background artifacts
        - compactness ≤ 15  : rejects jagged star/triangle shapes from low-contrast
                              gradient regions; real oil slicks are smooth elongated blobs
        - Larger morph kernel (5×5, 2 iter): better speckle suppression
        - compactness ≤ 12  : rejects jagged shapes
        - solidity ≥ 0.35   : rejects star/spike artifacts; real slicks = 0.5-1.0
        - Morph kernel (5×5, 2 iter): strong speckle suppression
    """
    img = cv2.imread(str(img_path), cv2.IMREAD_GRAYSCALE)
    if img is None:
        print(f"  ⚠️  Could not read: {img_path.name}")
        return []

    h, w = img.shape

    # Step 1: Gaussian blur to suppress radar speckle
    blurred = cv2.GaussianBlur(img, (5, 5), 0)

    # Step 2: Inverted Otsu — dark oil becomes white (255), bright water becomes black (0)
    _, thresh = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

    # Step 3a: Opening — removes isolated speckle dots
    kernel  = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    opened  = cv2.morphologyEx(thresh, cv2.MORPH_OPEN,  kernel, iterations=2)

    # Step 3b: Closing — fills micro-holes inside blobs, smooths their outer boundary
    #          This is the key step that eliminates sawtooth/zigzag polygon edges
    close_k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
    cleaned = cv2.morphologyEx(opened, cv2.MORPH_CLOSE, close_k, iterations=2)

    # Step 4: Find external contours
    contours, _ = cv2.findContours(cleaned, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    polygons = []
    img_area = float(h * w)

    for cnt in contours:
        area = cv2.contourArea(cnt)

        # --- Filter 1: size gates ---
        if area < min_area or (area / img_area) > max_area_ratio:
            continue

        # --- Filter 2: compactness (shape quality) ---
        # compactness = perimeter² / (4π × area)
        # Circle = 1.0 | smooth slick blob = ~2–8 | jagged noise artifact = 50+
        perimeter = cv2.arcLength(cnt, True)
        if perimeter == 0:
            continue
        compactness = (perimeter ** 2) / (4 * np.pi * area)
        if compactness > 15.0:   # reject jagged, star-shaped, triangular artifacts
            continue

        # --- Filter 3: solidity (rejects star/spike shapes) ---
        # solidity = contour_area / convex_hull_area
        # Real slick blob: 0.5–1.0 | Jagged star with spikes: 0.1–0.3
        hull    = cv2.convexHull(cnt)
        hull_area = cv2.contourArea(hull)
        if hull_area == 0:
            continue
        solidity = area / hull_area
        if solidity < 0.35:
            continue

        # --- Polygon approximation (smooth boundary) ---
        epsilon = 0.015 * perimeter   # looser → smoother polygon outline, fewer jagged vertices
        approx  = cv2.approxPolyDP(cnt, epsilon, True)

        if len(approx) < 3:
            continue

        # Normalize pixel (x, y) → relative [0.0, 1.0]
        coords = []
        for pt in approx:
            x, y   = pt[0]
            norm_x = round(max(0.0, min(1.0, float(x) / w)), 6)
            norm_y = round(max(0.0, min(1.0, float(y) / h)), 6)
            coords += [str(norm_x), str(norm_y)]

        if len(coords) >= 6:
            polygons.append("0 " + " ".join(coords))  # class 0 = oil_slick

    return polygons


# ─── Main ─────────────────────────────────────────────────────────────────────
def prepare_dataset(train_ratio: float = 0.8, seed: int = 42, neg_ratio: float = 1.0):
    random.seed(seed)
    np.random.seed(seed)

    print("=" * 62)
    print("🚀  Dataset Preparation  —  YOLOv8-Seg SAR Oil Spill")
    print(f"📁  Raw path : {RAW_DIR}")
    print("=" * 62)

    class_1_dir = RAW_DIR / "Class_1"
    class_0_dir = RAW_DIR / "Class_0"

    if not class_1_dir.exists():
        print(f"❌  {class_1_dir} not found. Check your raw data folder.")
        sys.exit(1)

    pos_files = sorted(class_1_dir.glob("*.jpg")) + sorted(class_1_dir.glob("*.png"))
    neg_files = sorted(class_0_dir.glob("*.jpg")) + sorted(class_0_dir.glob("*.png")) \
                if class_0_dir.exists() else []

    print(f"📊  Class_1 (Oil Slick)  : {len(pos_files)} images")
    print(f"📊  Class_0 (Background) : {len(neg_files)} images")

    # Create output dirs
    for split in ("train", "val"):
        (IMAGES_DIR / split).mkdir(parents=True, exist_ok=True)
        (LABELS_DIR / split).mkdir(parents=True, exist_ok=True)

    # Split positives 80/20
    random.shuffle(pos_files)
    cut       = int(len(pos_files) * train_ratio)
    train_pos = pos_files[:cut]
    val_pos   = pos_files[cut:]

    # Cap negatives to neg_ratio × number of positives
    if neg_files:
        random.shuffle(neg_files)
        n_neg       = min(len(neg_files), int(len(pos_files) * neg_ratio))
        neg_files   = neg_files[:n_neg]
        cut_n       = int(len(neg_files) * train_ratio)
        train_neg   = neg_files[:cut_n]
        val_neg     = neg_files[cut_n:]
    else:
        train_neg = val_neg = []

    splits = {"train": (train_pos, train_neg), "val": (val_pos, val_neg)}

    total_annotated = 0
    total_polygons  = 0

    for split, (pos_list, neg_list) in splits.items():
        print(f"\n🔄  [{split}]  {len(pos_list)} positives  +  {len(neg_list)} negatives")

        img_out = IMAGES_DIR / split
        lbl_out = LABELS_DIR / split

        # ── Positive images (Class_1) ──
        for i, p in enumerate(pos_list):
            shutil.copy2(p, img_out / p.name)
            polys = extract_contours(p)
            if polys:
                (lbl_out / f"{p.stem}.txt").write_text("\n".join(polys) + "\n")
                total_annotated += 1
                total_polygons  += len(polys)
            if (i + 1) % 200 == 0 or (i + 1) == len(pos_list):
                print(f"   ✔  {i+1}/{len(pos_list)} positive images processed")

        # ── Negative images (Class_0) — no label file ──
        for j, p in enumerate(neg_list):
            shutil.copy2(p, img_out / p.name)
            if (j + 1) % 200 == 0 or (j + 1) == len(neg_list):
                print(f"   ✔  {j+1}/{len(neg_list)} background images copied")

    # Write dataset.yaml
    yaml = f"""# YOLOv8 Segmentation — SAR Oil Spill Detection
# Auto-generated by prepare_dataset.py
# Dev 1 tile size: 416x416  |  Sensor: Sentinel-1 SAR  |  Normalization: 0-1

path: {DATA_DIR.as_posix()}
train: images/train
val:   images/val

nc: 1
names: ['oil_slick']
"""
    YAML_PATH.write_text(yaml)

    # Summary
    train_imgs = len(list((IMAGES_DIR / "train").glob("*.*")))
    val_imgs   = len(list((IMAGES_DIR / "val").glob("*.*")))

    print("\n" + "=" * 62)
    print("✅  Dataset Preparation Complete!")
    print(f"🖼️   Train images : {train_imgs}")
    print(f"🖼️   Val images   : {val_imgs}")
    print(f"🏷️   Oil polygons : {total_polygons}  across  {total_annotated}  images")
    print(f"📄  dataset.yaml  : {YAML_PATH}")
    print("=" * 62)
    print("\n▶  Next: python src\\train.py")


if __name__ == "__main__":
    prepare_dataset(train_ratio=0.8, seed=42, neg_ratio=1.0)


"""
inference.py - Full Inference & Vectorization Pipeline for SAR Oil Spill Detection.

Workflow:
1. Loads fine-tuned YOLOv8-Seg weights (weight/best.pt).
2. Reads 416x416 GeoTIFF tiles from Dev 1 (or standard test images).
3. Evaluates patches with confidence & heuristic false-positive rejection.
4. Uses vectorization.py (Affine Transform) to convert pixel contours to real GPS Lon/Lat.
5. Saves consolidated GeoJSON & optionally sends detected spills to the FastAPI backend.
"""

import os
import sys
import json
import argparse
from pathlib import Path
from datetime import datetime, timezone
from typing import List, Dict, Any

import cv2
import numpy as np
import rasterio
from ultralytics import YOLO
import requests

from vectorization import create_spill_payload

# ─── Paths ────────────────────────────────────────────────────────────────────
AI_MODEL_DIR = Path(__file__).resolve().parent.parent
WEIGHTS_PATH = AI_MODEL_DIR / "weight" / "best.pt"
OUTPUTS_DIR  = AI_MODEL_DIR / "outputs" / "detections"


def load_geotiff_tile(tif_path: Path) -> tuple[np.ndarray, rasterio.Affine, str]:
    """
    Reads a 3-band float32 GeoTIFF from Dev 1's pipeline.
    Returns:
        (image_rgb_uint8, affine_transform, crs_string)
    """
    with rasterio.open(tif_path) as src:
        # Dev 1 tile format: count=3 (Band 1: VV norm, Band 2: VH norm, Band 3: VV-VH norm)
        # Array shape: (3, 416, 416) with values in range [0.0, 1.0]
        data = src.read()
        transform = src.transform
        crs = str(src.crs)

    # Reorder from (channels, height, width) to (height, width, channels)
    data_hwc = np.transpose(data, (1, 2, 0))

    # Convert [0.0, 1.0] float32 to [0, 255] uint8 for YOLO input
    img_uint8 = np.clip(data_hwc * 255.0, 0, 255).astype(np.uint8)

    return img_uint8, transform, crs


def run_inference_on_tile(
    model: YOLO,
    img_array: np.ndarray,
    conf_threshold: float = 0.25,
    min_pixels: int = 50
) -> List[tuple[List[tuple[float, float]], float]]:
    """
    Runs YOLOv8-Seg inference on a single 416x416 array.
    Returns:
        List of (polygon_pixel_coords, confidence_score)
    """
    results = model.predict(
        source=img_array,
        conf=conf_threshold,
        imgsz=416,
        verbose=False
    )

    detected_polygons = []
    
    if not results or results[0].masks is None:
        return detected_polygons

    # Extract polygon contour points and confidence scores
    masks = results[0].masks.xy  # List of numpy arrays: shape (N, 2)
    boxes = results[0].boxes

    for i, mask in enumerate(masks):
        if len(mask) < 3:
            continue
        
        # Calculate pixel polygon area to reject micro false-positives
        poly_pts = [(float(pt[0]), float(pt[1])) for pt in mask]
        area = cv2.contourArea(np.array(poly_pts, dtype=np.float32))
        
        if area < min_pixels:
            continue

        conf = float(boxes.conf[i]) if boxes is not None and len(boxes.conf) > i else conf_threshold
        detected_polygons.append((poly_pts, conf))

    return detected_polygons


def process_tiles_directory(
    tiles_dir: Path,
    backend_url: str = None,
    conf_threshold: float = 0.25,
    save_visuals: bool = True
) -> List[Dict[str, Any]]:
    """
    Scans a directory of Dev 1 GeoTIFF tiles, runs detection + affine vectorization,
    and aggregates all incidents into a GeoJSON FeatureCollection.
    """
    if not WEIGHTS_PATH.exists():
        print(f"❌ Error: Model weights not found at {WEIGHTS_PATH}. Train the model first.")
        sys.exit(1)

    print("=" * 65)
    print("🛰️  Starting Sentinel-1 SAR Oil Spill Inference & Vectorization")
    print(f"📦 Model: {WEIGHTS_PATH}")
    print(f"📁 Input Tiles Directory: {tiles_dir}")
    print("=" * 65)

    model = YOLO(str(WEIGHTS_PATH))
    OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)

    tif_files = sorted(list(tiles_dir.glob("*.tif")) + list(tiles_dir.glob("*.tiff")))
    
    if not tif_files:
        # Fallback to standard images (png, jpg) if no geotiffs
        tif_files = sorted(list(tiles_dir.glob("*.jpg")) + list(tiles_dir.glob("*.png")))
        print(f"ℹ️  Found {len(tif_files)} standard image files.")
    else:
        print(f"ℹ️  Found {len(tif_files)} GeoTIFF tiles.")

    all_spill_payloads = []
    geojson_features = []
    detection_time_iso = datetime.now(timezone.utc).isoformat()

    for idx, file_path in enumerate(tif_files):
        is_geotiff = file_path.suffix.lower() in [".tif", ".tiff"]
        
        if is_geotiff:
            img_array, affine_tf, crs = load_geotiff_tile(file_path)
        else:
            img_bgr = cv2.imread(str(file_path))
            img_array = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
            # Default identity transform for standard images
            affine_tf = rasterio.Affine(1, 0, 0, 0, 1, 0)

        # 1. Run YOLOv8-Seg
        detected = run_inference_on_tile(model, img_array, conf_threshold=conf_threshold)

        if not detected:
            continue

        print(f"🚨 Detected {len(detected)} oil slick(s) in: {file_path.name}")

        # 2. Vectorize & build backend payloads
        for poly_coords, conf in detected:
            payload = create_spill_payload(
                pixel_polygon=poly_coords,
                geotiff_transform=affine_tf,
                detected_at_iso=detection_time_iso,
                confidence=conf,
                tile_name=file_path.name
            )

            if payload:
                all_spill_payloads.append(payload)

                # Format as GeoJSON Feature
                feature = {
                    "type": "Feature",
                    "geometry": payload["spill_polygon_geojson"],
                    "properties": {
                        "centroid_lat": payload["centroid_lat"],
                        "centroid_lon": payload["centroid_lon"],
                        "detected_at": payload["detected_at"],
                        "area_km2": payload["area_km2"],
                        "confidence": payload["confidence"],
                        "source_tile": payload["source_tile"]
                    }
                }
                geojson_features.append(feature)

                # 3. Optionally push directly to backend
                if backend_url:
                    try:
                        # Backend expects SpillInput schema: centroid_lat, centroid_lon, detected_at, spill_polygon_geojson
                        backend_payload = {
                            "centroid_lat": payload["centroid_lat"],
                            "centroid_lon": payload["centroid_lon"],
                            "detected_at": payload["detected_at"],
                            "spill_polygon_geojson": payload["spill_polygon_geojson"]
                        }
                        res = requests.post(f"{backend_url.rstrip('/')}/spills", json=backend_payload, timeout=5)
                        if res.status_code in [200, 201]:
                            print(f"   📡 Ingested into Backend -> Spill ID: {res.json().get('spill_id')}")
                        else:
                            print(f"   ⚠️  Backend responded: {res.status_code} - {res.text}")
                    except Exception as e:
                        print(f"   ⚠️  Could not reach backend at {backend_url}: {e}")

        # 4. Save visualization overlay
        if save_visuals:
            vis_img = img_array.copy()
            for poly_coords, conf in detected:
                pts = np.array(poly_coords, dtype=np.int32)
                cv2.polylines(vis_img, [pts], isClosed=True, color=(255, 0, 0), thickness=2)
                cv2.putText(vis_img, f"Oil: {conf:.2f}", (int(pts[0][0]), int(pts[0][1] - 5)),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.4, (255, 0, 0), 1)
            
            out_vis_path = OUTPUTS_DIR / f"det_{file_path.stem}.png"
            cv2.imwrite(str(out_vis_path), cv2.cvtColor(vis_img, cv2.COLOR_RGB2BGR))

    # Save consolidated GeoJSON
    consolidated_geojson = {
        "type": "FeatureCollection",
        "features": geojson_features
    }
    geojson_out_path = AI_MODEL_DIR / "outputs" / "detected_spills.geojson"
    with open(geojson_out_path, "w") as f:
        json.dump(consolidated_geojson, f, indent=2)

    print("\n" + "=" * 65)
    print("✅ Inference & Vectorization Complete!")
    print(f"📍 Total Detected Spills: {len(all_spill_payloads)}")
    print(f"🗺️  GeoJSON exported to: {geojson_out_path}")
    print(f"🖼️  Visual overlays saved to: {OUTPUTS_DIR}")
    print("=" * 65)

    return all_spill_payloads


def main():
    parser = argparse.ArgumentParser(description="SAR Oil Spill Inference & Vectorization Pipeline")
    parser.add_argument("--tiles", default=str(AI_MODEL_DIR / "data" / "images" / "val"),
                        help="Path to directory containing input tiles (.tif, .png, .jpg)")
    parser.add_argument("--backend", default=None,
                        help="Backend API base URL (e.g. http://localhost:8000)")
    parser.add_argument("--conf", type=float, default=0.25,
                        help="YOLO detection confidence threshold (default: 0.25)")
    args = parser.parse_args()

    process_tiles_directory(
        tiles_dir=Path(args.tiles),
        backend_url=args.backend,
        conf_threshold=args.conf
    )


if __name__ == "__main__":
    main()


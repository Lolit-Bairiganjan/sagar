"""
test_option3.py - End-to-End Verification Test for Option 3 Pipeline.

Usage:
  python ai-model/test_option3.py --sample (tests on real SAR oil spill tile)
  python ai-model/test_option3.py --synthetic (tests on calibrated 3-band SAR GeoTIFF)
  python ai-model/test_option3.py --live (tests via live Copernicus CDSE API with credentials)
"""

import os
import sys
import time
import json
import argparse
from pathlib import Path

# Add src to python path
SRC_DIR = Path(__file__).resolve().parent / "src"
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

import cv2
import numpy as np
import rasterio
from rasterio.windows import Window
from lightweight_tiler import TileItem, slice_geotiff_into_tiles
from onnx_detector import OnnxOilSpillDetector
from cdse_client import create_synthetic_test_geotiff, CopernicusCDSEClient
from pipeline_option3 import run_option3_pipeline


def test_on_real_sample_tile(sample_image: str = "ai-model/data/images/train/class_0_00041.jpg", conf: float = 0.15):
    print("=" * 65)
    print("  SAGAR OPTION 3: VERIFYING ONNX DETECTOR ON REAL SAR TILE")
    print("=" * 65)
    print(f"[*] Input image: {sample_image}")

    t0 = time.time()
    img = cv2.imread(sample_image)
    if img is None:
        raise FileNotFoundError(f"Image not found at: {sample_image}")

    img = cv2.resize(img, (416, 416))
    tensor = (img.transpose(2, 0, 1).astype(np.float32) / 255.0)

    # Affine transform centered over Mumbai High (19.45 N, 71.30 E)
    transform = rasterio.transform.from_origin(71.30, 19.50, 0.0001, 0.0001)
    tile_item = TileItem(tensor, transform, Window(0, 0, 416, 416), row_idx=0, col_idx=0)

    detector = OnnxOilSpillDetector(conf_threshold=conf)
    spills = detector.predict_tile(tile_item)
    elapsed = (time.time() - t0) * 1000

    print(f"\n[+] Inference & Vectorization Completed in: {elapsed:.1f} ms!")
    print(f"[+] Total Slicks Detected: {len(spills)}")

    for i, s in enumerate(spills):
        print(f"\n  --- Incident #{i + 1} ---")
        print(f"  Confidence        : {s['confidence'] * 100:.1f}%")
        print(f"  Centroid (Lat, Lon): ({s['centroid_lat']}, {s['centroid_lon']})")
        print(f"  Calculated Area   : {s['area_km2']} km²")
        coords = s['spill_polygon_geojson']['coordinates'][0]
        print(f"  Boundary Points   : {len(coords)} GPS vertices")
        print(f"  First 3 GPS points: {coords[:3]}")

    print("\n" + "=" * 65)
    return spills


def main():
    parser = argparse.ArgumentParser(description="Test SAGAR Option 3 Pipeline")
    parser.add_argument("--sample", action="store_true", help="Test on real SAR oil spill tile")
    parser.add_argument("--live", action="store_true", help="Test via live Copernicus CDSE API")
    parser.add_argument("--conf", type=float, default=0.15, help="Confidence threshold")

    args = parser.parse_args()

    if args.sample:
        test_on_real_sample_tile(conf=args.conf)
    else:
        run_option3_pipeline(
            bbox=(71.25, 19.35, 71.55, 19.65),
            use_live_cdse=args.live,
            conf_threshold=args.conf
        )


if __name__ == "__main__":
    main()

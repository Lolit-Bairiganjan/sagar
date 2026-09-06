"""
pipeline_option3.py - End-to-End Cloud-Native Satellite Surveillance Engine.

Integrates:
1. Copernicus CDSE Process API (Cloud-calibrated Sigma0 VV, VH, VV-VH in dB)
2. Lightweight in-memory P2/P98 normalizer & 416x416 tiler
3. Ultra-fast ONNX Runtime CPU inference engine (~16 ms / tile)
4. Vectorization engine producing WGS84 GeoJSON polygons & km² surface metrics
"""

import os
import sys
import json
import time
import argparse
from pathlib import Path
from datetime import datetime, timezone
from typing import List, Dict, Any, Tuple, Optional

# Add src directory to pythonpath
SRC_DIR = Path(__file__).resolve().parent
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

from cdse_client import CopernicusCDSEClient, create_synthetic_test_geotiff
from lightweight_tiler import slice_geotiff_into_tiles
from onnx_detector import OnnxOilSpillDetector


def run_option3_pipeline(
    bbox: Tuple[float, float, float, float] = (71.25, 19.35, 71.55, 19.65),
    output_geotiff: str = "ai-model/outputs/option3_scene.tif",
    onnx_model_path: str = "ai-model/weight/best.onnx",
    conf_threshold: float = 0.25,
    use_live_cdse: bool = False,
    post_to_backend_url: Optional[str] = None
) -> Dict[str, Any]:
    """
    Executes the complete Option 3 pipeline on a target Area of Interest (AOI).
    """
    start_time = time.time()
    print("=" * 70)
    print("  SAGAR MARITIME SURVEILLANCE — OPTION 3 PIPELINE")
    print("=" * 70)
    print(f"[*] Target AOI Bounding Box: {bbox}")
    print(f"[*] Inference Engine       : ONNX Runtime (CPUExecutionProvider)")
    print(f"[*] Mode                   : {'LIVE Copernicus CDSE API' if use_live_cdse else 'Test/Synthetic GeoTIFF Mode'}")

    timestamp_now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    # ─── Step 1: Ingest Calibrated SAR Scene ──────────────────────────────────
    step1_start = time.time()
    if use_live_cdse:
        print("\n[1/4] Querying Copernicus CDSE Process API for Sentinel-1 GRD...")
        client = CopernicusCDSEClient()
        scene_path = client.fetch_calibrated_geotiff(
            bbox=bbox,
            output_path=output_geotiff,
            width=832,
            height=832
        )
    else:
        print("\n[1/4] Generating calibrated 3-band SAR GeoTIFF (Offline/Test)...")
        scene_path = create_synthetic_test_geotiff(
            output_path=output_geotiff,
            bbox=bbox,
            width=832,
            height=832,
            inject_spill=True
        )
    print(f"      Scene saved: {scene_path} ({os.path.getsize(scene_path) / 1024:.1f} KB) in {time.time() - step1_start:.2f}s")

    # ─── Step 2: Tiling & Normalization ──────────────────────────────────────
    step2_start = time.time()
    print("\n[2/4] Normalizing backscatter (P2/P98) & slicing into 416x416 tiles...")
    tiles = slice_geotiff_into_tiles(scene_path, tile_size=416)
    print(f"      Generated {len(tiles)} candidate tiles in {time.time() - step2_start:.2f}s")

    # ─── Step 3: ONNX Neural Inference ───────────────────────────────────────
    step3_start = time.time()
    print("\n[3/4] Running YOLOv8-Seg ONNX inference on CPU...")
    detector = OnnxOilSpillDetector(
        onnx_model_path=onnx_model_path,
        conf_threshold=conf_threshold
    )

    all_detected_spills = []
    for i, tile in enumerate(tiles):
        tile_t0 = time.time()
        spills = detector.predict_tile(tile, timestamp_iso=timestamp_now)
        if spills:
            print(f"      Tile [{i + 1}/{len(tiles)}] -> DETECTED {len(spills)} slick(s) in {(time.time() - tile_t0)*1000:.1f}ms")
            all_detected_spills.extend(spills)
        else:
            print(f"      Tile [{i + 1}/{len(tiles)}] -> Clean in {(time.time() - tile_t0)*1000:.1f}ms")

    infer_elapsed = time.time() - step3_start
    print(f"      Total neural inference time: {infer_elapsed:.2f}s ({infer_elapsed / len(tiles) * 1000:.1f}ms/tile)")

    # ─── Step 4: Vectorization & Reporting ───────────────────────────────────
    total_area_km2 = sum(s.get("area_km2", 0.0) for s in all_detected_spills)
    summary = {
        "status": "ANOMALY_DETECTED" if all_detected_spills else "ZONE_CLEAN",
        "timestamp": timestamp_now,
        "aoi_bbox": list(bbox),
        "total_slicks_detected": len(all_detected_spills),
        "total_area_km2": round(total_area_km2, 3),
        "pipeline_latency_seconds": round(time.time() - start_time, 2),
        "spills": all_detected_spills
    }

    print("\n[4/4] Pipeline Execution Summary:")
    print(f"      Status                 : {summary['status']}")
    print(f"      Slicks Found           : {summary['total_slicks_detected']}")
    print(f"      Total Surface Area     : {summary['total_area_km2']} km²")
    print(f"      End-to-End Latency     : {summary['pipeline_latency_seconds']} seconds")

    # Optional: Forward to backend
    if post_to_backend_url and all_detected_spills:
        print(f"\n[*] Broadcasting detections to Backend: {post_to_backend_url}...")
        try:
            import requests
            resp = requests.post(post_to_backend_url, json=all_detected_spills[0], timeout=5)
            print(f"    Backend response: {resp.status_code}")
        except Exception as e:
            print(f"    Failed to contact backend: {e}")

    print("=" * 70)
    return summary


def main():
    parser = argparse.ArgumentParser(description="SAGAR Option 3 Satellite Surveillance Pipeline")
    parser.add_argument("--bbox", nargs=4, type=float, default=[71.25, 19.35, 71.55, 19.65],
                        help="Bounding box: min_lon min_lat max_lon max_lat")
    parser.add_argument("--live", action="store_true", help="Query live Copernicus CDSE API")
    parser.add_argument("--conf", type=float, default=0.25, help="Confidence threshold")
    parser.add_argument("--model", type=str, default="ai-model/weight/best.onnx", help="Path to ONNX weights")
    parser.add_argument("--post", type=str, default=None, help="Backend URL to post detections")

    args = parser.parse_args()
    summary = run_option3_pipeline(
        bbox=tuple(args.bbox),
        onnx_model_path=args.model,
        conf_threshold=args.conf,
        use_live_cdse=args.live,
        post_to_backend_url=args.post
    )

    # Save summary JSON
    out_json = "ai-model/outputs/option3_summary.json"
    os.makedirs(os.path.dirname(out_json), exist_ok=True)
    with open(out_json, "w") as f:
        json.dump(summary, f, indent=2)
    print(f"\n[+] Full GeoJSON summary saved to: {out_json}")


if __name__ == "__main__":
    main()

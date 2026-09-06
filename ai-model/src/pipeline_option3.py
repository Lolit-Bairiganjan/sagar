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
import numpy as np

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
    drill: bool = False,
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
    print(f"[*] Mode                   : {'EMERGENCY INCIDENT DRILL' if drill else ('LIVE Copernicus CDSE API' if use_live_cdse else 'Test/Synthetic GeoTIFF Mode')}")

    timestamp_now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    if drill:
        print("\n[!] INCIDENT DRILL: Loading ground-truth SAR oil slick into target zone...")
        import cv2
        import rasterio
        from rasterio.windows import Window
        from lightweight_tiler import TileItem

        sample_path = "ai-model/data/images/train/class_0_00041.jpg"
        if not os.path.exists(sample_path):
            sample_path = os.path.join(os.path.dirname(__file__), "..", "data", "images", "train", "class_0_00041.jpg")

        img = cv2.imread(sample_path)
        img = cv2.resize(img, (416, 416))
        tensor = (img.transpose(2, 0, 1).astype(np.float32) / 255.0)

        c_lon = (bbox[0] + bbox[2]) / 2.0
        c_lat = (bbox[1] + bbox[3]) / 2.0
        t_origin_lon = c_lon - (208 * 0.0003)
        t_origin_lat = c_lat + (208 * 0.0003)
        transform = rasterio.transform.from_origin(t_origin_lon, t_origin_lat, 0.0003, 0.0003)
        tile_item = TileItem(tensor, transform, Window(0, 0, 416, 416), row_idx=0, col_idx=0)

        detector = OnnxOilSpillDetector(onnx_model_path=onnx_model_path, conf_threshold=0.15)
        all_detected_spills = detector.predict_tile(tile_item, timestamp_iso=timestamp_now)
        print(f"      Ground-truth detection: {len(all_detected_spills)} slick(s) identified in {(time.time() - start_time)*1000:.1f}ms")
    else:
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

    # Save a human-viewable preview image for visual verification
    try:
        import cv2
        import rasterio
        target_tif = output_geotiff if os.path.exists(output_geotiff) else None
        if target_tif and os.path.exists(target_tif):
            with rasterio.open(target_tif) as src:
                b1 = src.read(1)
                valid = b1[np.isfinite(b1)]
                if len(valid) > 0:
                    p2, p98 = np.percentile(valid, (2, 98))
                    b1_clean = np.nan_to_num(b1, nan=p2)
                    b1_norm = np.clip((b1_clean - p2) / (p98 - p2 + 1e-6) * 255.0, 0, 255).astype(np.uint8)
                else:
                    b1_norm = np.zeros(b1.shape, dtype=np.uint8)

                preview_bgr = cv2.cvtColor(b1_norm, cv2.COLOR_GRAY2BGR)
                status_color = (0, 255, 0) if summary['status'] == 'ZONE_CLEAN' else (0, 0, 255)
                cv2.putText(preview_bgr, f"Sentinel-1 SAR: {summary['status']}", (15, 30),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.7, status_color, 2)
                preview_path = "ai-model/outputs/latest_sar_preview.jpg"
                cv2.imwrite(preview_path, preview_bgr)
                print(f"      Visual radar inspection image saved: {preview_path}")
    except Exception:
        pass

    print("=" * 70)
    return summary


def main():
    parser = argparse.ArgumentParser(description="SAGAR Option 3 Satellite Surveillance Pipeline")
    parser.add_argument("--bbox", nargs=4, type=float, default=[71.25, 19.35, 71.55, 19.65],
                        help="Bounding box: min_lon min_lat max_lon max_lat")
    parser.add_argument("--live", action="store_true", help="Query live Copernicus CDSE API")
    parser.add_argument("--drill", action="store_true", help="Run simulated emergency spill incident drill")
    parser.add_argument("--conf", type=float, default=0.25, help="Confidence threshold")
    parser.add_argument("--model", type=str, default="ai-model/weight/best.onnx", help="Path to ONNX weights")
    parser.add_argument("--post", type=str, default=None, help="Backend URL to post detections")

    args = parser.parse_args()
    summary = run_option3_pipeline(
        bbox=tuple(args.bbox),
        onnx_model_path=args.model,
        conf_threshold=args.conf,
        use_live_cdse=args.live,
        drill=args.drill,
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

"""
surveillance.py - Live Satellite Surveillance Scan API.

Exposes the Option 3 ONNX pipeline as an HTTP endpoint so the frontend
can trigger on-demand Copernicus SAR scans over priority maritime zones.
"""

import json
import subprocess
import os
import sys
from pathlib import Path
from typing import Optional, List

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/api", tags=["surveillance"])

# ---------------------------------------------------------------------------
# Predefined priority maritime surveillance zones (Global Chokepoints & EEZ)
# ---------------------------------------------------------------------------
PRIORITY_ZONES = {
    # Global Critical Chokepoints & International Tanker Corridors
    "strait_of_hormuz": {
        "label": "Strait of Hormuz",
        "bbox": [56.10, 26.20, 56.65, 26.65],
        "description": "Persian Gulf crude export artery (Global Chokepoint)",
    },
    "singapore_strait": {
        "label": "Singapore & Malacca",
        "bbox": [103.65, 1.15, 104.15, 1.45],
        "description": "East Asia crude artery & busy anchorage (Global Chokepoint)",
    },
    "bab_el_mandeb": {
        "label": "Bab-el-Mandeb (Red Sea)",
        "bbox": [43.15, 12.50, 43.65, 13.00],
        "description": "Southern entrance to Suez Canal (Global Chokepoint)",
    },
    "english_channel": {
        "label": "Strait of Dover",
        "bbox": [1.15, 50.85, 1.75, 51.25],
        "description": "English Channel commercial shipping gateway (Europe)",
    },
    "gulf_of_mexico": {
        "label": "Gulf of Mexico",
        "bbox": [-90.40, 28.55, -89.80, 29.15],
        "description": "Mississippi Canyon offshore crude platforms (Americas)",
    },
    "north_sea": {
        "label": "North Sea (Brent Field)",
        "bbox": [1.85, 56.20, 2.45, 56.80],
        "description": "Northern European offshore drilling & tanker routes (Europe)",
    },
    "bosphorus_strait": {
        "label": "Bosphorus Strait",
        "bbox": [29.00, 41.10, 29.35, 41.35],
        "description": "Black Sea & Mediterranean crude transit (Eurasia)",
    },
    "panama_approach": {
        "label": "Panama Canal Approach",
        "bbox": [-79.70, 8.70, -79.35, 9.10],
        "description": "Pacific entrance to Panama Canal (Americas)",
    },
    # Indian Ocean & Regional EEZ Strategic Zones
    "mumbai_high": {
        "label": "Mumbai High",
        "bbox": [71.25, 19.35, 71.55, 19.65],
        "description": "Offshore oil platforms & western tanker lanes (India)",
    },
    "gulf_of_kutch": {
        "label": "Gulf of Kutch",
        "bbox": [69.20, 22.30, 69.70, 22.70],
        "description": "Jamnagar & Kandla crude import terminals (India)",
    },
    "gulf_of_khambhat": {
        "label": "Gulf of Khambhat",
        "bbox": [72.10, 20.80, 72.70, 21.40],
        "description": "Dahej & Hazira chemical / LNG corridor (India)",
    },
    "goa_coast": {
        "label": "Goa & Konkan",
        "bbox": [73.40, 14.80, 73.90, 15.30],
        "description": "Central western EEZ shipping route (India)",
    },
    "cochin_lakshadweep": {
        "label": "Cochin / Lakshadweep",
        "bbox": [75.80, 9.70, 76.30, 10.20],
        "description": "Southern crude route & Lakshadweep Sea (India)",
    },
    "palk_strait": {
        "label": "Palk Strait",
        "bbox": [79.20, 9.00, 79.80, 9.50],
        "description": "Indo-Sri Lanka maritime boundary (South Asia)",
    },
    "chennai_port": {
        "label": "Chennai & Ennore",
        "bbox": [80.20, 13.00, 80.70, 13.50],
        "description": "Eastern commercial & petroleum anchorage (India)",
    },
    "vizag_anchorage": {
        "label": "Visakhapatnam",
        "bbox": [83.20, 17.50, 83.70, 18.00],
        "description": "Eastern naval command & port waters (India)",
    },
    "paradip_dhamra": {
        "label": "Paradip & Dhamra",
        "bbox": [86.60, 20.10, 87.10, 20.60],
        "description": "Northern Bay of Bengal bulk crude gateway (India)",
    },
    "sundarbans_haldia": {
        "label": "Haldia & Sundarbans",
        "bbox": [87.90, 21.30, 88.50, 21.80],
        "description": "Ganges Delta navigation channels (India/Bangladesh)",
    },
    "malacca_approach": {
        "label": "Great Nicobar (Malacca)",
        "bbox": [93.60, 6.40, 94.10, 6.90],
        "description": "World's busiest crude tanker chokepoint (Indian Ocean)",
    },
}

# Resolve paths relative to this file
_BACKEND_DIR = Path(__file__).resolve().parent.parent.parent  # backend/
_PROJECT_ROOT = _BACKEND_DIR.parent  # sagar/
_PIPELINE_SCRIPT = _PROJECT_ROOT / "ai-model" / "src" / "pipeline_option3.py"
_OUTPUT_JSON = _PROJECT_ROOT / "ai-model" / "outputs" / "option3_summary.json"


def get_ai_python_executable() -> Path:
    """
    Dynamically finds the best Python executable to run the AI pipeline:
    1. Dedicated ai-model venv on Windows: ai-model/.venv/Scripts/python.exe
    2. Dedicated ai-model venv on Linux: ai-model/.venv/bin/python
    3. Active running Python interpreter (sys.executable) - ideal for Docker/Render/Cloud
    """
    win_venv = _PROJECT_ROOT / "ai-model" / ".venv" / "Scripts" / "python.exe"
    if win_venv.exists():
        return win_venv
    linux_venv = _PROJECT_ROOT / "ai-model" / ".venv" / "bin" / "python"
    if linux_venv.exists():
        return linux_venv
    return Path(sys.executable)


# ---------------------------------------------------------------------------
# Request / Response schemas
# ---------------------------------------------------------------------------
class ScanRequest(BaseModel):
    zone: Optional[str] = None  # e.g. "mumbai_high"
    bbox: Optional[List[float]] = None  # [min_lon, min_lat, max_lon, max_lat]
    drill: Optional[bool] = False  # If true, simulate emergency spill incident drill
    start_date: Optional[str] = None  # ISO date string or YYYY-MM-DD
    end_date: Optional[str] = None  # ISO date string or YYYY-MM-DD
    sensor: Optional[str] = "Sentinel-1 SAR"
    cloud_cover: Optional[float] = 10.0


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@router.get("/surveillance/zones")
def list_zones():
    """Returns the predefined priority surveillance zones."""
    return {"zones": PRIORITY_ZONES}


@router.post("/surveillance/scan")
def trigger_scan(req: ScanRequest):
    """
    Triggers a live Copernicus SAR scan over a maritime zone.

    Accepts either a zone name (e.g. "mumbai_high") or a custom bbox.
    Runs the Option 3 pipeline via subprocess and returns the detection result.
    """
    # Resolve bounding box
    zone_label = "Custom AOI"
    if req.zone:
        if req.zone not in PRIORITY_ZONES:
            raise HTTPException(
                status_code=400,
                detail=f"Unknown zone '{req.zone}'. Available: {list(PRIORITY_ZONES.keys())}"
            )
        zone_info = PRIORITY_ZONES[req.zone]
        bbox = zone_info["bbox"]
        zone_label = zone_info["label"]
    elif req.bbox:
        if len(req.bbox) != 4:
            raise HTTPException(status_code=400, detail="bbox must have exactly 4 values: [min_lon, min_lat, max_lon, max_lat]")
        raw_w, raw_s, raw_e, raw_n = req.bbox
        # Auto-sort coordinates in case user entered them inverted
        min_lon = min(float(raw_w), float(raw_e))
        max_lon = max(float(raw_w), float(raw_e))
        min_lat = min(float(raw_s), float(raw_n))
        max_lat = max(float(raw_s), float(raw_n))

        if not (-180.0 <= min_lon <= 180.0 and -180.0 <= max_lon <= 180.0):
            raise HTTPException(status_code=400, detail="Longitudes must be between -180 and 180 degrees.")
        if not (-90.0 <= min_lat <= 90.0 and -90.0 <= max_lat <= 90.0):
            raise HTTPException(status_code=400, detail="Latitudes must be between -90 and 90 degrees.")
        if min_lon == max_lon or min_lat == max_lat:
            raise HTTPException(status_code=400, detail="Bounding box area must be greater than 0.")
        if (max_lon - min_lon) > 2.0 or (max_lat - min_lat) > 2.0:
            raise HTTPException(
                status_code=400,
                detail=f"AOI span too large (width: {round(max_lon - min_lon, 2)}°, height: {round(max_lat - min_lat, 2)}°). Sentinel-1 SAR surveillance requires a bounding box span under 2.0° (approx 200 km)."
            )

        bbox = [round(min_lon, 4), round(min_lat, 4), round(max_lon, 4), round(max_lat, 4)]
    else:
        raise HTTPException(status_code=400, detail="Provide either 'zone' or 'bbox'")

    # Verify pipeline prerequisites exist
    ai_python = get_ai_python_executable()
    if not ai_python.exists():
        raise HTTPException(status_code=500, detail=f"Python interpreter not found at {ai_python}")
    if not _PIPELINE_SCRIPT.exists():
        raise HTTPException(status_code=500, detail=f"Pipeline script not found at {_PIPELINE_SCRIPT}")

    # Ensure output directory exists
    _OUTPUT_JSON.parent.mkdir(parents=True, exist_ok=True)

    # Build subprocess command
    cmd = [
        str(ai_python),
        str(_PIPELINE_SCRIPT),
        "--bbox", str(bbox[0]), str(bbox[1]), str(bbox[2]), str(bbox[3]),
    ]
    if req.drill:
        cmd.append("--drill")
    else:
        cmd.append("--live")

    if req.start_date:
        cmd.extend(["--from-date", req.start_date])
    if req.end_date:
        cmd.extend(["--to-date", req.end_date])

    try:
        result = subprocess.run(
            cmd,
            cwd=str(_PROJECT_ROOT),
            capture_output=True,
            text=True,
            timeout=60,
        )
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=504, detail="Pipeline timed out after 60 seconds")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to execute pipeline: {e}")

    if result.returncode != 0:
        raise HTTPException(
            status_code=500,
            detail=f"Pipeline exited with code {result.returncode}: {result.stderr[-500:] if result.stderr else 'no stderr'}"
        )

    # Read the output JSON
    if not _OUTPUT_JSON.exists():
        raise HTTPException(status_code=500, detail="Pipeline completed but output JSON not found")

    try:
        with open(_OUTPUT_JSON, "r") as f:
            summary = json.load(f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read pipeline output: {e}")

    # Persist detected spills to Supabase via existing backend logic
    persisted_spill_ids = []
    if summary.get("spills"):
        try:
            from app.queries.spills import insert_spill
            from app.schemas import SpillInput
            from app.services.drift import process_new_spill

            for spill_data in summary["spills"]:
                if not spill_data.get("spill_polygon_geojson"):
                    continue
                c_lat = float(spill_data.get("centroid_lat") or 0.0)
                c_lon = float(spill_data.get("centroid_lon") or 0.0)
                det_at = spill_data.get("detected_at", summary.get("timestamp", ""))
                spill_input = SpillInput(
                    centroid_lat=c_lat,
                    centroid_lon=c_lon,
                    detected_at=det_at,
                    spill_polygon_geojson=spill_data["spill_polygon_geojson"],
                )
                spill_id = insert_spill(spill_input)
                persisted_spill_ids.append(spill_id)

                # Compute reverse-drift trajectory immediately
                try:
                    process_new_spill(spill_id, c_lat, c_lon, det_at)
                except Exception as drift_err:
                    print(f"Notice: Drift computation for spill {spill_id} failed: {drift_err}")
        except Exception as e:
            # Don't fail the scan if DB insert fails - still return detections
            summary["db_persist_error"] = str(e)

    # Enrich response
    summary["zone"] = zone_label
    summary["zone_key"] = req.zone or "custom"
    summary["persisted_spill_ids"] = persisted_spill_ids
    summary["sensor"] = req.sensor or "Sentinel-1 SAR"
    summary["time_window"] = {
        "start": req.start_date or "latest_pass",
        "end": req.end_date or "now",
    }

    return summary

"""
surveillance.py - Live Satellite Surveillance Scan API.

Exposes the Option 3 ONNX pipeline as an HTTP endpoint so the frontend
can trigger on-demand Copernicus SAR scans over priority maritime zones.
"""

import json
import subprocess
import os
from pathlib import Path
from typing import Optional, List

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(tags=["surveillance"])

# ---------------------------------------------------------------------------
# Predefined priority maritime surveillance zones across Indian Ocean & EEZ
# ---------------------------------------------------------------------------
PRIORITY_ZONES = {
    "mumbai_high": {
        "label": "Mumbai High",
        "bbox": [71.25, 19.35, 71.55, 19.65],
        "description": "Offshore crude platforms & western tanker lanes",
    },
    "gulf_of_kutch": {
        "label": "Gulf of Kutch",
        "bbox": [69.20, 22.30, 69.70, 22.70],
        "description": "Jamnagar & Kandla crude import terminals",
    },
    "gulf_of_khambhat": {
        "label": "Gulf of Khambhat",
        "bbox": [72.10, 20.80, 72.70, 21.40],
        "description": "Dahej & Hazira chemical / LNG corridor",
    },
    "goa_coast": {
        "label": "Goa & Konkan",
        "bbox": [73.40, 14.80, 73.90, 15.30],
        "description": "Central western EEZ shipping route",
    },
    "cochin_lakshadweep": {
        "label": "Cochin / Lakshadweep",
        "bbox": [75.80, 9.70, 76.30, 10.20],
        "description": "Southern crude route & Lakshadweep Sea",
    },
    "palk_strait": {
        "label": "Palk Strait",
        "bbox": [79.20, 9.00, 79.80, 9.50],
        "description": "Indo-Sri Lanka maritime boundary",
    },
    "chennai_port": {
        "label": "Chennai & Ennore",
        "bbox": [80.20, 13.00, 80.70, 13.50],
        "description": "Eastern commercial & petroleum anchorage",
    },
    "vizag_anchorage": {
        "label": "Visakhapatnam",
        "bbox": [83.20, 17.50, 83.70, 18.00],
        "description": "Naval base & crude refinery anchorage",
    },
    "paradip_port": {
        "label": "Paradip & Dhamra",
        "bbox": [86.60, 20.10, 87.10, 20.60],
        "description": "Northern Bay of Bengal bulk crude gateway",
    },
    "sundarbans_haldia": {
        "label": "Haldia & Sundarbans",
        "bbox": [87.90, 21.30, 88.50, 21.80],
        "description": "Ganges Delta navigation channels",
    },
    "malacca_approach": {
        "label": "Great Nicobar (Malacca)",
        "bbox": [93.60, 6.40, 94.10, 6.90],
        "description": "World's busiest crude tanker chokepoint",
    },
}

# Resolve paths relative to this file
_BACKEND_DIR = Path(__file__).resolve().parent.parent.parent  # backend/
_PROJECT_ROOT = _BACKEND_DIR.parent  # sagar/
_AI_MODEL_PYTHON = _PROJECT_ROOT / "ai-model" / ".venv" / "Scripts" / "python.exe"
_PIPELINE_SCRIPT = _PROJECT_ROOT / "ai-model" / "src" / "pipeline_option3.py"
_OUTPUT_JSON = _PROJECT_ROOT / "ai-model" / "outputs" / "option3_summary.json"


# ---------------------------------------------------------------------------
# Request / Response schemas
# ---------------------------------------------------------------------------
class ScanRequest(BaseModel):
    zone: Optional[str] = None  # e.g. "mumbai_high"
    bbox: Optional[List[float]] = None  # [min_lon, min_lat, max_lon, max_lat]
    drill: Optional[bool] = False  # If true, simulate emergency spill incident drill


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
        bbox = req.bbox
    else:
        raise HTTPException(status_code=400, detail="Provide either 'zone' or 'bbox'")

    # Verify pipeline prerequisites exist
    if not _AI_MODEL_PYTHON.exists():
        raise HTTPException(status_code=500, detail=f"AI model Python not found at {_AI_MODEL_PYTHON}")
    if not _PIPELINE_SCRIPT.exists():
        raise HTTPException(status_code=500, detail=f"Pipeline script not found at {_PIPELINE_SCRIPT}")

    # Build subprocess command
    cmd = [
        str(_AI_MODEL_PYTHON),
        str(_PIPELINE_SCRIPT),
        "--bbox", str(bbox[0]), str(bbox[1]), str(bbox[2]), str(bbox[3]),
    ]
    if req.drill:
        cmd.append("--drill")
    else:
        cmd.append("--live")

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

            for spill_data in summary["spills"]:
                if not spill_data.get("spill_polygon_geojson"):
                    continue
                spill_input = SpillInput(
                    centroid_lat=spill_data.get("centroid_lat", 0.0),
                    centroid_lon=spill_data.get("centroid_lon", 0.0),
                    detected_at=spill_data.get("detected_at", summary.get("timestamp", "")),
                    spill_polygon_geojson=spill_data["spill_polygon_geojson"],
                )
                spill_id = insert_spill(spill_input)
                persisted_spill_ids.append(spill_id)
        except Exception as e:
            # Don't fail the scan if DB insert fails - still return detections
            summary["db_persist_error"] = str(e)

    # Enrich response
    summary["zone"] = zone_label
    summary["zone_key"] = req.zone or "custom"
    summary["persisted_spill_ids"] = persisted_spill_ids

    return summary

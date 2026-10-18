from datetime import datetime
from typing import Optional
from fastapi import APIRouter, HTTPException

from app.schemas import SpillInput
from app.queries.spills import insert_spill, get_all_spills, get_spill_by_id
from app.queries.reconstructions import get_latest_reconstruction
from app.queries.suspects import AISCoverageError, get_suspects
from app.services.drift import (
    DRIFT_MODEL_LIMITATIONS,
    process_new_spill,
    estimate_spill_area_km2,
)

router = APIRouter(tags=["spills"])


@router.get("/spills")
def list_spills(limit: int = 50):
    """Returns a list of all historical spill events with summary metrics."""
    try:
        spills = get_all_spills(limit=limit)
        return {"spills": spills, "total": len(spills)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch historical spills: {e}") from e


@router.get("/spills/{spill_id}")
def spill_detail(
    spill_id: int,
    origin_lat: Optional[float] = None,
    origin_lon: Optional[float] = None,
):
    """
    Returns full details for a historical spill:
    - GeoJSON polygon
    - Backtrack drift trajectory and estimated discharge origin
    - Oceanographic conditions at time of detection
    - Ranked suspect vessel candidates from PostGIS AIS correlation
    - MapView-ready 'spill' object
    """
    try:
        data = get_spill_by_id(spill_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database query failed: {e}") from e

    if not data:
        raise HTTPException(status_code=404, detail=f"Spill {spill_id} not found")

    # Fetch suspect vessels using passed or estimated origin. Missing AIS coverage
    # must be surfaced as data quality status instead of a silent empty list.
    suspect_rows = []
    coverage_error = None
    try:
        suspect_rows = get_suspects(spill_id, origin_lat=origin_lat, origin_lon=origin_lon)
    except AISCoverageError as exc:
        coverage_error = str(exc)
    except Exception as exc:
        coverage_error = f"AIS candidate query failed: {exc}"
        suspect_rows = []

    # Construct frontend-compatible coordinates ring
    ring = []
    poly = data.get("polygon_geojson")
    if poly and poly.get("coordinates") and len(poly["coordinates"]) > 0:
        first_ring = poly["coordinates"][0]
        ring = [{"lat": float(pt[1]), "lng": float(pt[0])} for pt in first_ring]

    centroid_lat = float(data.get("centroid_lat") or 0.0)
    centroid_lon = float(data.get("centroid_lon") or 0.0)

    # Origin point
    if origin_lat is not None and origin_lon is not None:
        origin_coords = {"lat": float(origin_lat), "lng": float(origin_lon)}
    else:
        origin_pt = data.get("estimated_origin_geojson")
        if origin_pt and origin_pt.get("coordinates"):
            origin_coords = {"lat": float(origin_pt["coordinates"][1]), "lng": float(origin_pt["coordinates"][0])}
        elif data.get("origin_lat") is not None and data.get("origin_lon") is not None:
            origin_coords = {"lat": float(data.get("origin_lat")), "lng": float(data.get("origin_lon"))}
        else:
            origin_coords = None

    detected_at_dt = data.get("detected_at")
    if isinstance(detected_at_dt, datetime):
        detected_iso = detected_at_dt.isoformat()
        estimated_discharge = data.get("estimated_discharge_at")
        if isinstance(estimated_discharge, datetime):
            origin_iso = estimated_discharge.isoformat()
        else:
            origin_iso = None
    else:
        detected_iso = str(detected_at_dt or "")
        origin_iso = None

    backtrack = []
    if origin_coords:
        hours_drift = data.get("drift_hours_assumed")
        backtrack.append({
            "label": f"T-{int(hours_drift)}h" if hours_drift is not None else "ESTIMATED ORIGIN",
            "location": origin_coords,
            "timestampUtc": origin_iso or "",
        })
    backtrack.append({
        "label": "NOW",
        "location": {"lat": centroid_lat, "lng": centroid_lon},
        "timestampUtc": detected_iso,
        "isCurrent": True,
    })

    # Frontend-compatible 'spill' payload
    spill_obj = {
        "id": f"SPILL-{spill_id:04d}",
        "status": "ACTIVE_INVESTIGATION",
        "detectionConfidencePct": None,
        "estimatedAreaKm2": float(data.get("area_km2") or 0.0),
        "estimatedAgeHours": (
            float(data["drift_hours_assumed"])
            if data.get("drift_hours_assumed") is not None
            else None
        ),
        "detectionSource": "Copernicus Sentinel-1 SAR",
        "observedAtUtc": detected_iso,
        "centroid": {"lat": centroid_lat, "lng": centroid_lon},
        "polygon": {"ring": ring},
        "origin": {
            "location": origin_coords,
            "estimatedAtUtc": origin_iso,
            "confidencePct": None,
            "uncertainty": {
                "status": "not_quantified",
                "probabilityCalibrated": False,
                "positionBoundsKm": None,
                "limitations": [
                    "The stored estimate has no calibrated position-uncertainty model.",
                    "Use the reconstruction endpoint for saved frame-level input quality and provenance.",
                    *DRIFT_MODEL_LIMITATIONS,
                ],
            },
        },
        "drift": {
            "backtrack": backtrack,
            "forecast": [],
        },
    }

    # Leave unavailable environmental inputs empty rather than filling defaults.
    wind_spd_kmh = data.get("wind_speed_kmh")
    current_spd_kmh = data.get("current_speed_kmh")
    ocean_obj = {
        "windDirectionDeg": (
            float(data["wind_direction_deg"])
            if data.get("wind_direction_deg") is not None
            else None
        ),
        "windSpeedKn": (
            round(float(wind_spd_kmh) / 1.852, 1)
            if wind_spd_kmh is not None
            else None
        ),
        "currentDirectionDeg": (
            float(data["current_direction_deg"])
            if data.get("current_direction_deg") is not None
            else None
        ),
        "currentSpeedKn": (
            round(float(current_spd_kmh) / 1.852, 1)
            if current_spd_kmh is not None
            else None
        ),
        "seaStateM": None,
        "temperatureC": None,
    }

    return {
        "spill_id": spill_id,
        "spill": spill_obj,
        "ocean": ocean_obj,
        "suspects": suspect_rows,
        "coverage_status": (
            "unavailable" if coverage_error and "failed" in coverage_error.lower()
            else "insufficient_ais_coverage" if coverage_error
            else "available" if suspect_rows
            else "no_candidates"
        ),
        "coverage_error": coverage_error,
        "raw": data,
    }


@router.get("/spills/{spill_id}/reconstruction")
def spill_reconstruction(spill_id: int):
    """Returns the latest persisted drift reconstruction and its hourly frames."""
    try:
        if not get_spill_by_id(spill_id):
            raise HTTPException(status_code=404, detail=f"Spill {spill_id} not found")
        reconstruction = get_latest_reconstruction(spill_id)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch reconstruction for spill {spill_id}: {e}",
        ) from e

    if reconstruction is None:
        raise HTTPException(
            status_code=404,
            detail=f"No persisted reconstruction found for spill {spill_id}",
        )
    return reconstruction


@router.post("/spills")
def create_spill(spill_data: SpillInput):
    """Inserts a new spill and immediately triggers reverse-drift estimation."""
    try:
        spill_id = insert_spill(spill_data)
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to insert spill") from e

    try:
        spill_area_km2 = estimate_spill_area_km2(spill_data.spill_polygon_geojson)
        process_new_spill(
            spill_id,
            spill_data.centroid_lat,
            spill_data.centroid_lon,
            spill_data.detected_at,
            spill_area_km2=spill_area_km2,
        )
    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail=f"Spill {spill_id} created but drift estimation failed: {e}",
        ) from e

    return {"spill_id": spill_id, "status": "created"}
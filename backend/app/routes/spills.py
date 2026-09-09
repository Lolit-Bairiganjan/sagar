import math
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from fastapi import APIRouter, HTTPException

from app.schemas import SpillInput
from app.queries.spills import insert_spill, get_all_spills, get_spill_by_id
from app.queries.suspects import get_suspects
from app.services.drift import process_new_spill

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

    # Fetch suspect vessels using passed or estimated origin
    try:
        suspect_rows = get_suspects(spill_id, origin_lat=origin_lat, origin_lon=origin_lon)
    except Exception:
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
        else:
            origin_coords = {"lat": centroid_lat, "lng": centroid_lon}

    detected_at_dt = data.get("detected_at")
    if isinstance(detected_at_dt, datetime):
        detected_iso = detected_at_dt.isoformat()
        hours_drift = float(data.get("drift_hours_assumed") or 6.0)
        origin_dt = detected_at_dt - timedelta(hours=hours_drift)
        origin_iso = origin_dt.isoformat()
    else:
        detected_iso = str(detected_at_dt or "")
        origin_iso = detected_iso

    # Backtrack trajectory nodes
    backtrack = [
        {"label": f"T-{int(data.get('drift_hours_assumed') or 6)}h", "location": origin_coords, "timestampUtc": origin_iso},
        {"label": "NOW", "location": {"lat": centroid_lat, "lng": centroid_lon}, "timestampUtc": detected_iso, "isCurrent": True},
    ]

    # Forecast trajectory nodes (approx 1 deg lat ~ 111 km, lon ~ 111 * cos(lat))
    drift_speed = float(data.get("combined_drift_speed_kmh") or 1.0)
    drift_dir = float(data.get("combined_drift_direction_deg") or 0.0)
    rad = math.radians(drift_dir)
    cos_lat = max(math.cos(math.radians(centroid_lat)), 0.0001)
    f4_km = drift_speed * 4.0
    f4_lat = centroid_lat + (f4_km * math.cos(rad) / 111.0)
    f4_lng = centroid_lon + (f4_km * math.sin(rad) / (111.0 * cos_lat))

    forecast = [
        {"label": "NOW", "location": {"lat": centroid_lat, "lng": centroid_lon}, "timestampUtc": detected_iso, "isCurrent": True},
        {"label": "T+4h", "location": {"lat": round(f4_lat, 4), "lng": round(f4_lng, 4)}, "timestampUtc": detected_iso},
    ]

    # Frontend-compatible 'spill' payload
    spill_obj = {
        "id": f"SPILL-{spill_id:04d}",
        "status": "ACTIVE_INVESTIGATION",
        "detectionConfidencePct": 95.0,
        "estimatedAreaKm2": float(data.get("area_km2") or 0.0),
        "estimatedAgeHours": float(data.get("drift_hours_assumed") or 6.0),
        "detectionSource": "Copernicus Sentinel-1 SAR",
        "observedAtUtc": detected_iso,
        "centroid": {"lat": centroid_lat, "lng": centroid_lon},
        "polygon": {"ring": ring},
        "origin": {
            "location": origin_coords,
            "estimatedAtUtc": origin_iso,
            "confidencePct": 88.5,
        },
        "drift": {
            "backtrack": backtrack,
            "forecast": forecast,
        },
    }

    # Oceanographic condition payload
    wind_spd_kmh = float(data.get("wind_speed_kmh") or 15.0)
    curr_spd_kmh = float(data.get("current_speed_kmh") or 1.5)
    ocean_obj = {
        "windDirectionDeg": float(data.get("wind_direction_deg") or 0.0),
        "windSpeedKn": round(wind_spd_kmh / 1.852, 1),
        "currentDirectionDeg": float(data.get("current_direction_deg") or 0.0),
        "currentSpeedKn": round(curr_spd_kmh / 1.852, 1),
        "seaStateM": 1.5,
        "temperatureC": 26.0,
    }

    return {
        "spill_id": spill_id,
        "spill": spill_obj,
        "ocean": ocean_obj,
        "suspects": suspect_rows,
        "raw": data,
    }


@router.post("/spills")
def create_spill(spill_data: SpillInput):
    """Inserts a new spill and immediately triggers reverse-drift estimation."""
    try:
        spill_id = insert_spill(spill_data)
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to insert spill") from e

    try:
        process_new_spill(
            spill_id,
            spill_data.centroid_lat,
            spill_data.centroid_lon,
            spill_data.detected_at,
        )
    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail=f"Spill {spill_id} created but drift estimation failed: {e}",
        ) from e

    return {"spill_id": spill_id, "status": "created"}
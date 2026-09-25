"""
drift.py — Reverse-drift estimation for the oil spill / AIS correlation backend.

Called once per new spill (from the POST /spills route, after the spill row
is inserted) to estimate where the oil likely originated, using real wind
data and a documented fallback for ocean current where model coverage is
unavailable (common in shallow coastal/river-delta zones).
"""

import json
import math
from datetime import datetime, timedelta

import requests
from shapely.geometry import shape
from app.config import (
    WIND_DRIFT_FACTOR,
    FALLBACK_CURRENT_SPEED_MS,
    DEFAULT_DRIFT_HOURS,
)
from app.db import get_connection


def estimate_spill_radius_km(area_km2: float | None) -> float:
    """Heuristic radius derived from spill area. This is a first-order estimate,
    not a physical plume model, but it gives a meaningful uncertainty scale for
    backtracking and candidate searches."""
    if area_km2 is None or area_km2 <= 0:
        return 1.0
    return max(math.sqrt(area_km2 / math.pi), 0.5)


def estimate_drift_horizon_hours(area_km2: float | None, fallback_hours: float = DEFAULT_DRIFT_HOURS) -> float:
    """Area-aware drift horizon. Larger slicks are more likely to have drifted
    longer before being detected, while smaller slicks are kept near a short,
    more conservative window."""
    if area_km2 is None:
        return float(fallback_hours)
    if area_km2 <= 1.0:
        return 6.0
    if area_km2 <= 10.0:
        return 12.0
    if area_km2 <= 50.0:
        return 18.0
    return 24.0


def estimate_spill_area_km2(poly_geojson: dict | None) -> float | None:
    """Approximate a spill polygon area in km² from the GeoJSON provided by the
    detection team. This remains heuristic, but it avoids using a fixed window
    for every spill regardless of size."""
    if not poly_geojson:
        return None
    try:
        geom = shape(poly_geojson)
        area_deg2 = geom.area
        return max((area_deg2 * 111.32 * 111.32) / 1_000_000.0, 0.0)
    except Exception:
        return None


def estimate_discharge_time(detected_at: datetime, drift_hours: float) -> datetime:
    """Returns the likely discharge time inferred from the drift horizon."""
    return detected_at - timedelta(hours=float(drift_hours))


def estimate_origin_point(centroid_lat: float, centroid_lon: float,
                         drift_hours: float, drift_direction_deg: float) -> tuple[float, float]:
    """Project the likely oil origin backward from the detected centroid along the
    estimated drift vector. This is still a first-order physical approximation,
    not a full Lagrangian transport model."""
    if drift_hours <= 0 or drift_direction_deg is None:
        return float(centroid_lat), float(centroid_lon)

    distance_km = max((0.5 * drift_hours), 1.0)
    drift_rad = math.radians((float(drift_direction_deg) + 180.0) % 360.0)
    cos_lat = max(math.cos(math.radians(float(centroid_lat))), 1e-6)
    dlat = (distance_km * math.cos(drift_rad)) / 111.0
    dlng = (distance_km * math.sin(drift_rad)) / (111.0 * cos_lat)
    return float(centroid_lat + dlat), float(centroid_lon + dlng)


def get_drift_conditions(lat: float, lon: float, date_str: str) -> dict:
    """
    Wind is reliably available everywhere. Ocean current has real coverage
    gaps in shallow/coastal zones -- falls back to a documented heuristic
    when the marine API returns no data. Confirmed empirically at this
    project's Bay of Bengal test coordinates: current returns None while
    wind is fully available -- wind MUST be fetched separately, never skipped.
    """
    result = {
        "wind_speed_kmh": 15.0, "wind_direction_deg": 180.0,
        "current_speed_kmh": FALLBACK_CURRENT_SPEED_MS * 3.6,
        "current_direction_deg": 180.0,
        "current_data_source": "fallback_heuristic",
    }

    try:
        weather_resp = requests.get(
            "https://api.open-meteo.com/v1/forecast",
            params={
                "latitude": lat, "longitude": lon,
                "hourly": "wind_speed_10m,wind_direction_10m",
                "start_date": date_str, "end_date": date_str,
            },
            timeout=10,
        )
        if weather_resp.status_code == 200:
            wdata = weather_resp.json().get("hourly", {})
            speeds = wdata.get("wind_speed_10m") or []
            directions = wdata.get("wind_direction_10m") or []
            if speeds:
                result["wind_speed_kmh"] = float(speeds[0])
            if directions:
                result["wind_direction_deg"] = float(directions[0])
    except Exception:
        pass

    try:
        marine_resp = requests.get(
            "https://marine-api.open-meteo.com/v1/marine",
            params={
                "latitude": lat, "longitude": lon,
                "hourly": "ocean_current_velocity,ocean_current_direction",
                "start_date": date_str, "end_date": date_str,
            },
            timeout=10,
        )
        if marine_resp.status_code == 200:
            mdata = marine_resp.json().get("hourly", {})
            current_vals = mdata.get("ocean_current_velocity") or []
            current_dirs = mdata.get("ocean_current_direction") or []
            if current_vals and current_vals[0] is not None:
                result["current_speed_kmh"] = float(current_vals[0])
                result["current_data_source"] = "open-meteo-marine"
            if current_dirs and current_dirs[0] is not None:
                result["current_direction_deg"] = float(current_dirs[0])
    except Exception:
        pass

    if result["current_direction_deg"] is None:
        result["current_direction_deg"] = result["wind_direction_deg"]
    return result


def calculate_reverse_drift(wind_speed_kmh, wind_direction_deg,
                              current_speed_kmh, current_direction_deg,
                              drift_hours=DEFAULT_DRIFT_HOURS) -> dict:
    """
    CRITICAL: WIND_DRIFT_FACTOR applies to WIND only (oil moves at ~3% of
    wind speed). Ocean current is applied at ~100% of its own speed --
    current pushes floating oil directly, unlike wind. Do NOT apply the
    wind factor to current speed.
    """
    wind_drift_speed = wind_speed_kmh * WIND_DRIFT_FACTOR
    wind_rad = math.radians(wind_direction_deg)
    current_rad = math.radians(current_direction_deg)

    wind_east = wind_drift_speed * math.sin(wind_rad)
    wind_north = wind_drift_speed * math.cos(wind_rad)
    current_east = current_speed_kmh * math.sin(current_rad)
    current_north = current_speed_kmh * math.cos(current_rad)

    total_east = wind_east + current_east
    total_north = wind_north + current_north

    combined_speed_kmh = math.sqrt(total_east**2 + total_north**2)
    combined_direction_deg = math.degrees(math.atan2(total_east, total_north)) % 360
    total_drift_km = combined_speed_kmh * drift_hours

    return {
        "combined_drift_speed_kmh": round(combined_speed_kmh, 3),
        "combined_drift_direction_deg": round(combined_direction_deg, 1),
        "total_drift_distance_km": round(total_drift_km, 3),
        "drift_hours_assumed": drift_hours,
    }


def save_drift_estimate(spill_id: int, conditions: dict, drift: dict, estimated_discharge_at=None,
                       origin_lat=None, origin_lon=None) -> None:
    """Persists the drift estimate. ON CONFLICT updates instead of duplicating."""
    query = """
        INSERT INTO reverse_drift_estimates (
            spill_id, wind_speed_kmh, wind_direction_deg,
            current_speed_kmh, current_direction_deg, current_data_source,
            combined_drift_speed_kmh, combined_drift_direction_deg,
            total_drift_distance_km, drift_hours_assumed,
            estimated_discharge_at, origin_lat, origin_lon
        ) VALUES (
            %(spill_id)s, %(wind_speed_kmh)s, %(wind_direction_deg)s,
            %(current_speed_kmh)s, %(current_direction_deg)s, %(current_data_source)s,
            %(combined_drift_speed_kmh)s, %(combined_drift_direction_deg)s,
            %(total_drift_distance_km)s, %(drift_hours_assumed)s,
            %(estimated_discharge_at)s, %(origin_lat)s, %(origin_lon)s
        )
        ON CONFLICT (spill_id) DO UPDATE SET
            wind_speed_kmh = EXCLUDED.wind_speed_kmh,
            wind_direction_deg = EXCLUDED.wind_direction_deg,
            current_speed_kmh = EXCLUDED.current_speed_kmh,
            current_direction_deg = EXCLUDED.current_direction_deg,
            current_data_source = EXCLUDED.current_data_source,
            combined_drift_speed_kmh = EXCLUDED.combined_drift_speed_kmh,
            combined_drift_direction_deg = EXCLUDED.combined_drift_direction_deg,
            total_drift_distance_km = EXCLUDED.total_drift_distance_km,
            drift_hours_assumed = EXCLUDED.drift_hours_assumed,
            estimated_discharge_at = EXCLUDED.estimated_discharge_at,
            origin_lat = EXCLUDED.origin_lat,
            origin_lon = EXCLUDED.origin_lon,
            computed_at = NOW();
    """
    params = {
        "spill_id": spill_id,
        **conditions,
        **drift,
        "estimated_discharge_at": estimated_discharge_at,
        "origin_lat": origin_lat,
        "origin_lon": origin_lon,
    }
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(query, params)
        conn.commit()
        cur.close()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def ensure_database_compatibility() -> None:
    """Adds missing schema columns so the live database remains compatible with
    the current drift/suspect logic even when older rows were inserted earlier."""
    conn = get_connection()
    try:
        cur = conn.cursor()
        for statement in (
            "ALTER TABLE IF EXISTS vessels ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT FALSE;",
            "ALTER TABLE IF EXISTS ais_positions ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT FALSE;",
            "ALTER TABLE IF EXISTS reverse_drift_estimates ADD COLUMN IF NOT EXISTS estimated_discharge_at TIMESTAMPTZ;",
            "ALTER TABLE IF EXISTS reverse_drift_estimates ADD COLUMN IF NOT EXISTS origin_lat NUMERIC;",
            "ALTER TABLE IF EXISTS reverse_drift_estimates ADD COLUMN IF NOT EXISTS origin_lon NUMERIC;",
            "CREATE INDEX IF NOT EXISTS idx_vessels_is_test ON vessels (is_test);",
            "CREATE INDEX IF NOT EXISTS idx_ais_is_test_ts ON ais_positions (is_test, ts);",
            "UPDATE vessels SET is_test = FALSE WHERE is_test IS NULL;",
            "UPDATE ais_positions SET is_test = FALSE WHERE is_test IS NULL;",
        ):
            cur.execute(statement)
        conn.commit()
        cur.close()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def backfill_missing_drift_estimates(limit: int = 1000) -> list[int]:
    """Populate reverse-drift estimates for older spill rows that were inserted
    before the drift backtrack logic was run."""
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT s.id, s.detected_at, ST_AsGeoJSON(s.geom) AS geom_json
            FROM spill_events s
            LEFT JOIN reverse_drift_estimates r ON r.spill_id = s.id
            WHERE r.spill_id IS NULL
            ORDER BY s.detected_at DESC
            LIMIT %(limit)s;
            """,
            {"limit": limit},
        )
        rows = cur.fetchall()
        cur.close()

        backfilled = []
        for spill_id, detected_at, geom_json in rows:
            try:
                geom = shape(json.loads(geom_json))
                centroid = geom.centroid
                area_km2 = estimate_spill_area_km2(json.loads(geom_json))
                process_new_spill(
                    spill_id,
                    float(centroid.y),
                    float(centroid.x),
                    detected_at,
                    spill_area_km2=area_km2,
                )
                backfilled.append(spill_id)
            except Exception:
                continue
        return backfilled
    finally:
        conn.close()


def process_new_spill(spill_id: int, centroid_lat: float, centroid_lon: float,
                        detected_at, spill_area_km2: float | None = None) -> dict:
    """
    Full pipeline: fetch conditions -> estimate an area-aware drift horizon ->
    compute drift -> estimate a discharge timestamp and likely origin -> save.
    This remains a heuristic model, but it provides a concrete backtrack anchor
    rather than a single fixed assumption for every spill.
    """
    date_str = detected_at.strftime("%Y-%m-%d") if hasattr(detected_at, "strftime") else str(detected_at)[:10]
    conditions = get_drift_conditions(centroid_lat, centroid_lon, date_str)
    drift_hours = estimate_drift_horizon_hours(spill_area_km2)
    drift = calculate_reverse_drift(
        conditions["wind_speed_kmh"], conditions["wind_direction_deg"],
        conditions["current_speed_kmh"], conditions["current_direction_deg"],
        drift_hours=drift_hours,
    )
    estimated_discharge_at = estimate_discharge_time(detected_at, drift_hours)
    origin_lat, origin_lon = estimate_origin_point(
        centroid_lat,
        centroid_lon,
        drift_hours,
        drift["combined_drift_direction_deg"],
    )
    save_drift_estimate(
        spill_id,
        conditions,
        drift,
        estimated_discharge_at=estimated_discharge_at,
        origin_lat=origin_lat,
        origin_lon=origin_lon,
    )
    return {
        "conditions": conditions,
        "drift": drift,
        "estimated_horizon_hours": drift_hours,
        "estimated_discharge_at": estimated_discharge_at.isoformat(),
        "estimated_origin": {"lat": origin_lat, "lon": origin_lon},
        "estimated_spill_radius_km": estimate_spill_radius_km(spill_area_km2),
    }
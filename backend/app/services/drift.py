"""
drift.py — Reverse-drift estimation for the oil spill / AIS correlation backend.

Called once per new spill (from the POST /spills route, after the spill row
is inserted) to estimate where the oil likely originated using timestamped
wind and current data. Missing required data stops reconstruction explicitly.
"""

import json
import math
from datetime import datetime, timedelta, timezone

import requests
from shapely.geometry import shape
from app.config import (
    WIND_DRIFT_FACTOR,
    DEFAULT_DRIFT_HOURS,
)
from app.db import get_connection


class DriftDataError(RuntimeError):
    """Raised when required timestamped weather or current data is unavailable."""


DRIFT_MODEL_VERSION = "stepwise-hourly-v1"
DRIFT_MODEL_LIMITATIONS = [
    "Position uncertainty is not calibrated; no probability or spatial bounds are available.",
    "Hourly gridded wind/current inputs are sampled at the nearest hour to each step midpoint.",
    "Forcing data is requested at the initial spill coordinate and held fixed along the path.",
    "Oil type, evaporation, emulsification, slick-area evolution, and turbulent dispersion are not modeled.",
    "Coastline and land-boundary interactions are not modeled.",
]


def estimate_spill_radius_km(area_km2: float | None) -> float:
    """Heuristic radius derived from spill area. This is a first-order estimate,
    not a physical plume model, but it gives a meaningful uncertainty scale for
    backtracking and candidate searches."""
    if area_km2 is None or area_km2 <= 0:
        return 1.0
    return max(math.sqrt(area_km2 / math.pi), 0.5)


def estimate_drift_horizon_hours(area_km2: float | None, fallback_hours: float = DEFAULT_DRIFT_HOURS) -> float:
    """Area-aware drift horizon. The horizon grows smoothly with spill size but
    stays conservative so small slicks do not get an excessive backtrack window,
    while larger slicks can justify a longer reverse-drift estimate.

    This keeps the logic anchored in observed spill area rather than forcing a
    single fixed value for every incident.
    """
    if area_km2 is None:
        return float(fallback_hours)

    if area_km2 <= 1.0:
        return 6.0

    if area_km2 <= 10.0:
        t = (area_km2 - 1.0) / 9.0
        return 6.0 + t * 6.0

    if area_km2 <= 50.0:
        t = (area_km2 - 10.0) / 40.0
        return 12.0 + t * 6.0

    if area_km2 <= 200.0:
        t = (area_km2 - 50.0) / 150.0
        return 18.0 + t * 6.0

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


def _parse_api_hour(value: str) -> datetime:
    timestamp = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if timestamp.tzinfo is None:
        timestamp = timestamp.replace(tzinfo=timezone.utc)
    return timestamp.astimezone(timezone.utc)


def _request_hourly_values(url: str, params: dict, fields: tuple[str, ...]) -> dict[datetime, dict]:
    try:
        response = requests.get(url, params=params, timeout=15)
        response.raise_for_status()
        payload = response.json()
        hourly = payload["hourly"]
        times = hourly["time"]
        values = {field: hourly[field] for field in fields}
    except (requests.RequestException, KeyError, TypeError, ValueError) as exc:
        raise DriftDataError(f"Unable to retrieve hourly data from {url}: {exc}") from exc

    if any(len(series) != len(times) for series in values.values()):
        raise DriftDataError(f"Hourly data from {url} has mismatched timestamps and values.")

    return {
        _parse_api_hour(timestamp): {
            **{field: values[field][index] for field in fields},
            "grid_latitude": payload.get("latitude"),
            "grid_longitude": payload.get("longitude"),
        }
        for index, timestamp in enumerate(times)
    }


def fetch_hourly_drift_conditions(
    lat: float,
    lon: float,
    start_at: datetime,
    end_at: datetime,
) -> dict[datetime, dict]:
    """Fetches timestamped wind and surface-current values without fallbacks."""
    start_at = _as_utc(start_at)
    end_at = _as_utc(end_at)
    if start_at > end_at:
        raise ValueError("start_at must not be later than end_at.")
    start_date = start_at.date().isoformat()
    end_date = end_at.date().isoformat()
    today = datetime.now(timezone.utc).date()
    weather_url = (
        "https://archive-api.open-meteo.com/v1/archive"
        if end_at.date() < today
        else "https://api.open-meteo.com/v1/forecast"
    )
    weather_source = "open-meteo-archive" if "archive" in weather_url else "open-meteo-forecast"
    common_params = {
        "latitude": lat,
        "longitude": lon,
        "start_date": start_date,
        "end_date": end_date,
        "timezone": "UTC",
    }
    wind = _request_hourly_values(
        weather_url,
        {
            **common_params,
            "hourly": "wind_speed_10m,wind_direction_10m",
            "wind_speed_unit": "kmh",
        },
        ("wind_speed_10m", "wind_direction_10m"),
    )
    marine = _request_hourly_values(
        "https://marine-api.open-meteo.com/v1/marine",
        {
            **common_params,
            "hourly": "ocean_current_velocity,ocean_current_direction",
        },
        ("ocean_current_velocity", "ocean_current_direction"),
    )

    timestamps = set(wind) | set(marine)
    return {
        timestamp: {
            **wind.get(timestamp, {}),
            **marine.get(timestamp, {}),
            "wind_speed_kmh": wind.get(timestamp, {}).get("wind_speed_10m"),
            "wind_direction_deg": wind.get(timestamp, {}).get("wind_direction_10m"),
            "current_speed_kmh": marine.get(timestamp, {}).get("ocean_current_velocity"),
            "current_direction_deg": marine.get(timestamp, {}).get("ocean_current_direction"),
            "wind_data_source": weather_source,
            "current_data_source": "open-meteo-marine",
            "wind_grid_latitude": wind.get(timestamp, {}).get("grid_latitude"),
            "wind_grid_longitude": wind.get(timestamp, {}).get("grid_longitude"),
            "current_grid_latitude": marine.get(timestamp, {}).get("grid_latitude"),
            "current_grid_longitude": marine.get(timestamp, {}).get("grid_longitude"),
        }
        for timestamp in timestamps
    }


def _as_utc(value: datetime | str) -> datetime:
    if isinstance(value, str):
        value = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _nearest_hour(value: datetime) -> datetime:
    return (value + timedelta(minutes=30)).replace(minute=0, second=0, microsecond=0)


def _validate_drift_sample(timestamp: datetime, sample: dict) -> tuple[float, float, float, float]:
    fields = (
        "wind_speed_kmh",
        "wind_direction_deg",
        "current_speed_kmh",
        "current_direction_deg",
    )
    missing = [field for field in fields if sample.get(field) is None]
    if missing:
        raise DriftDataError(
            f"Missing required drift data at {timestamp.isoformat()}: {', '.join(missing)}."
        )

    values = tuple(float(sample[field]) for field in fields)
    if not all(math.isfinite(value) for value in values):
        raise DriftDataError(f"Non-finite drift data at {timestamp.isoformat()}.")
    if values[0] < 0 or values[2] < 0:
        raise DriftDataError(f"Negative wind/current speed at {timestamp.isoformat()}.")
    if not 0 <= values[1] <= 360 or not 0 <= values[3] <= 360:
        raise DriftDataError(f"Invalid wind/current direction at {timestamp.isoformat()}.")
    return values


def integrate_reverse_drift(
    centroid_lat: float,
    centroid_lon: float,
    detected_at: datetime | str,
    drift_hours: float,
    hourly_conditions: dict[datetime, dict],
) -> dict:
    """Integrates the slick position backward using hourly, time-varying inputs."""
    if drift_hours <= 0 or drift_hours > 24:
        raise ValueError("drift_hours must be greater than 0 and no more than 24.")

    detection_time = _as_utc(detected_at)
    current_time = detection_time
    lat = float(centroid_lat)
    lon = float(centroid_lon)
    elapsed = 0.0
    net_east_km = 0.0
    net_north_km = 0.0
    path_distance_km = 0.0
    conditions_used = []
    frames = [{
        "label": "NOW",
        "timestampUtc": detection_time.isoformat(),
        "hoursBeforeDetection": 0.0,
        "location": {"lat": lat, "lng": lon},
        "isCurrent": True,
    }]

    while elapsed < drift_hours:
        step_hours = min(1.0, drift_hours - elapsed)
        midpoint = current_time - timedelta(hours=step_hours / 2)
        sample_time = _nearest_hour(midpoint)
        sample = hourly_conditions.get(sample_time)
        if sample is None:
            raise DriftDataError(f"No hourly wind/current record for {sample_time.isoformat()}.")
        wind_speed, wind_from_deg, current_speed, current_to_deg = _validate_drift_sample(
            sample_time, sample
        )
        conditions_used.append(sample)

        # Meteorological wind direction indicates where wind comes from; current
        # direction indicates the direction the current flows toward.
        wind_to_rad = math.radians((wind_from_deg + 180.0) % 360.0)
        current_to_rad = math.radians(current_to_deg % 360.0)
        east_kmh = (
            wind_speed * WIND_DRIFT_FACTOR * math.sin(wind_to_rad)
            + current_speed * math.sin(current_to_rad)
        )
        north_kmh = (
            wind_speed * WIND_DRIFT_FACTOR * math.cos(wind_to_rad)
            + current_speed * math.cos(current_to_rad)
        )
        east_step_km = east_kmh * step_hours
        north_step_km = north_kmh * step_hours
        segment_distance_km = math.hypot(east_step_km, north_step_km)
        net_east_km -= east_step_km
        net_north_km -= north_step_km
        path_distance_km += segment_distance_km

        cos_lat = max(math.cos(math.radians(lat)), 1e-6)
        lat -= north_step_km / 111.0
        lon -= east_step_km / (111.0 * cos_lat)
        elapsed += step_hours
        current_time -= timedelta(hours=step_hours)

        frames.append({
            "label": f"T-{elapsed:g}h",
            "timestampUtc": current_time.isoformat(),
            "hoursBeforeDetection": round(elapsed, 3),
            "location": {"lat": round(lat, 6), "lng": round(lon, 6)},
            "weather": {
                "sampledAtUtc": sample_time.isoformat(),
                "windSpeedKmh": wind_speed,
                "windDirectionFromDeg": wind_from_deg,
                "currentSpeedKmh": current_speed,
                "currentDirectionToDeg": current_to_deg,
                "windSource": sample.get("wind_data_source", "unspecified"),
                "currentSource": sample.get("current_data_source", "unspecified"),
                "windGrid": {
                    "lat": sample.get("wind_grid_latitude"),
                    "lng": sample.get("wind_grid_longitude"),
                },
                "currentGrid": {
                    "lat": sample.get("current_grid_latitude"),
                    "lng": sample.get("current_grid_longitude"),
                },
                "inputStatus": "complete",
            },
            })

    net_distance_km = math.hypot(net_east_km, net_north_km)
    direction_deg = math.degrees(math.atan2(net_east_km, net_north_km)) % 360.0
    representative_conditions = conditions_used[0]
    frames.reverse()
    return {
        "model_version": DRIFT_MODEL_VERSION,
        "conditions": {
            "wind_speed_kmh": representative_conditions["wind_speed_kmh"],
            "wind_direction_deg": representative_conditions["wind_direction_deg"],
            "current_speed_kmh": representative_conditions["current_speed_kmh"],
            "current_direction_deg": representative_conditions["current_direction_deg"],
            "current_data_source": representative_conditions["current_data_source"],
        },
        "drift": {
            "combined_drift_speed_kmh": round(net_distance_km / drift_hours, 3),
            "combined_drift_direction_deg": round(direction_deg, 1),
            "total_drift_distance_km": round(net_distance_km, 3),
            "path_distance_km": round(path_distance_km, 3),
            "drift_hours_assumed": drift_hours,
        },
        "frames": frames,
        "estimated_origin": {"lat": round(lat, 6), "lng": round(lon, 6)},
        "uncertainty": {
            "status": "not_quantified",
            "probability_calibrated": False,
            "position_bounds_km": None,
            "coastline_interaction": {
                "status": "not_modeled",
                "path_may_cross_land": True,
                "positions_are_clipped_to_coastline": False,
            },
            "slick_evolution": {
                "status": "not_modeled",
                "fragmentation_or_patchiness": "not represented",
                "emulsification": "not represented",
                "area_by_frame": None,
            },
            "data_quality": {
                "status": "complete",
                "required_hourly_samples": len(conditions_used),
                "complete_hourly_samples": len(conditions_used),
                "temporal_resolution_hours": 1,
            },
            "assumptions": [
                f"Wind leeway factor is {WIND_DRIFT_FACTOR:.3f}.",
                "Current direction represents the direction the current flows toward.",
            ],
            "limitations": DRIFT_MODEL_LIMITATIONS,
            "oil_scenarios": {
                "status": "not_modeled",
                "reason": "Oil-property parameters and validated weathering data have not been selected.",
            },
        },
    }


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
    wind_rad = math.radians((wind_direction_deg + 180.0) % 360.0)
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
                       origin_lat=None, origin_lon=None, reconstruction: dict | None = None) -> None:
    """Persists the drift estimate and its traceable reconstruction in one transaction."""
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
        if reconstruction is not None:
            frames = reconstruction["frames"]
            cur.execute(
                """
                INSERT INTO reconstruction_runs (
                    spill_id, model_version, status, detected_at, horizon_hours,
                    start_at, end_at, summary, uncertainty, input_provenance
                ) VALUES (
                    %(spill_id)s, %(model_version)s, 'complete', %(detected_at)s,
                    %(horizon_hours)s, %(start_at)s, %(end_at)s,
                    %(summary)s::jsonb, %(uncertainty)s::jsonb, %(input_provenance)s::jsonb
                )
                RETURNING id;
                """,
                {
                    "spill_id": spill_id,
                    "model_version": reconstruction["model_version"],
                    "detected_at": reconstruction["detected_at"],
                    "horizon_hours": reconstruction["drift"]["drift_hours_assumed"],
                    "start_at": reconstruction["start_at"],
                    "end_at": reconstruction["detected_at"],
                    "summary": json.dumps({
                        "drift": reconstruction["drift"],
                        "estimated_origin": reconstruction["estimated_origin"],
                    }),
                    "uncertainty": json.dumps(reconstruction["uncertainty"]),
                    "input_provenance": json.dumps(reconstruction["input_provenance"]),
                },
            )
            run_id = cur.fetchone()[0]
            cur.executemany(
                """
                INSERT INTO reconstruction_frames (
                    run_id, frame_index, timestamp_utc, hours_before_detection,
                    latitude, longitude, frame_data
                ) VALUES (
                    %(run_id)s, %(frame_index)s, %(timestamp_utc)s,
                    %(hours_before_detection)s, %(latitude)s, %(longitude)s,
                    %(frame_data)s::jsonb
                );
                """,
                [
                    {
                        "run_id": run_id,
                        "frame_index": index,
                        "timestamp_utc": _as_utc(frame["timestampUtc"]),
                        "hours_before_detection": frame["hoursBeforeDetection"],
                        "latitude": frame["location"]["lat"],
                        "longitude": frame["location"]["lng"],
                        "frame_data": json.dumps(frame),
                    }
                    for index, frame in enumerate(frames)
                ],
            )
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
            """
            CREATE TABLE IF NOT EXISTS reconstruction_runs (
                id BIGSERIAL PRIMARY KEY,
                spill_id INTEGER NOT NULL REFERENCES spill_events(id) ON DELETE CASCADE,
                model_version TEXT NOT NULL,
                status TEXT NOT NULL CHECK (status IN ('complete')),
                detected_at TIMESTAMPTZ NOT NULL,
                horizon_hours NUMERIC NOT NULL CHECK (horizon_hours > 0 AND horizon_hours <= 24),
                start_at TIMESTAMPTZ NOT NULL,
                end_at TIMESTAMPTZ NOT NULL,
                summary JSONB NOT NULL,
                uncertainty JSONB NOT NULL,
                input_provenance JSONB NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            """,
            """
            CREATE TABLE IF NOT EXISTS reconstruction_frames (
                id BIGSERIAL PRIMARY KEY,
                run_id BIGINT NOT NULL REFERENCES reconstruction_runs(id) ON DELETE CASCADE,
                frame_index INTEGER NOT NULL CHECK (frame_index >= 0),
                timestamp_utc TIMESTAMPTZ NOT NULL,
                hours_before_detection NUMERIC NOT NULL CHECK (hours_before_detection >= 0),
                latitude DOUBLE PRECISION NOT NULL CHECK (latitude BETWEEN -90 AND 90),
                longitude DOUBLE PRECISION NOT NULL CHECK (longitude BETWEEN -180 AND 180),
                frame_data JSONB NOT NULL,
                UNIQUE (run_id, frame_index)
            );
            """,
            "CREATE INDEX IF NOT EXISTS idx_reconstruction_runs_spill_created ON reconstruction_runs (spill_id, created_at DESC);",
            "CREATE INDEX IF NOT EXISTS idx_reconstruction_frames_run_time ON reconstruction_frames (run_id, timestamp_utc);",
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
    Fetch timestamped forcing, integrate backward, and save the net estimate.
    Per-step frames are returned for later persistence by the reconstruction API.
    """
    detection_time = _as_utc(detected_at)
    drift_hours = estimate_drift_horizon_hours(spill_area_km2)
    start_at = detection_time - timedelta(hours=drift_hours)
    hourly_conditions = fetch_hourly_drift_conditions(
        centroid_lat,
        centroid_lon,
        start_at,
        detection_time,
    )
    reconstruction = integrate_reverse_drift(
        centroid_lat,
        centroid_lon,
        detection_time,
        drift_hours,
        hourly_conditions,
    )
    conditions = reconstruction["conditions"]
    drift = reconstruction["drift"]
    estimated_discharge_at = estimate_discharge_time(detection_time, drift_hours)
    origin_lat = reconstruction["estimated_origin"]["lat"]
    origin_lon = reconstruction["estimated_origin"]["lng"]
    save_drift_estimate(
        spill_id,
        conditions,
        drift,
        estimated_discharge_at=estimated_discharge_at,
        origin_lat=origin_lat,
        origin_lon=origin_lon,
        reconstruction={
            **reconstruction,
            "detected_at": detection_time,
            "start_at": start_at,
            "input_provenance": {
                "provider": "Open-Meteo",
                "wind_source": conditions["wind_data_source"],
                "current_source": conditions["current_data_source"],
                "wind_grid": {
                    "lat": reconstruction["frames"][0]["weather"]["windGrid"]["lat"],
                    "lng": reconstruction["frames"][0]["weather"]["windGrid"]["lng"],
                },
                "current_grid": {
                    "lat": reconstruction["frames"][0]["weather"]["currentGrid"]["lat"],
                    "lng": reconstruction["frames"][0]["weather"]["currentGrid"]["lng"],
                },
                "requested_coordinate": {"lat": centroid_lat, "lng": centroid_lon},
                "temporal_resolution_hours": 1,
                "wind_drift_factor": WIND_DRIFT_FACTOR,
            },
        },
    )
    return {
        "conditions": conditions,
        "drift": drift,
        "estimated_horizon_hours": drift_hours,
        "estimated_discharge_at": estimated_discharge_at.isoformat(),
        "estimated_origin": {"lat": origin_lat, "lon": origin_lon},
        "estimated_spill_radius_km": estimate_spill_radius_km(spill_area_km2),
        "frames": reconstruction["frames"],
        "model_version": reconstruction["model_version"],
        "uncertainty": reconstruction["uncertainty"],
    }
"""
suspects.py — Runs the finalized spatio-temporal suspect-scoring query
for a given spill and returns ranked candidate vessels.
"""

from datetime import datetime, timedelta

from app.config import (
    AIS_HEADING_MAX_PING_GAP_HOURS,
    AIS_ORIGIN_TIME_BUFFER_HOURS,
    SPILL_AREA_BUFFER_TIERS_KM,
)
from app.db import get_connection


class AISCoverageError(RuntimeError):
    """Raised when a spill has no usable AIS positions in the relevant window."""


def evaluate_ais_coverage(candidate_rows: int, distinct_mmsi: int) -> dict:
    """Return a structured status for the AIS coverage gate used before suspect ranking."""
    candidate_rows = int(candidate_rows or 0)
    distinct_mmsi = int(distinct_mmsi or 0)
    coverage_ok = candidate_rows > 0 and distinct_mmsi > 0

    if coverage_ok:
        return {
            "coverage_ok": True,
            "candidate_rows": candidate_rows,
            "distinct_mmsi": distinct_mmsi,
            "message": f"AIS coverage confirmed: {candidate_rows} records / {distinct_mmsi} vessels.",
        }

    return {
        "coverage_ok": False,
        "candidate_rows": candidate_rows,
        "distinct_mmsi": distinct_mmsi,
        "message": (
            "No AIS coverage: no positions are available within the estimated-origin corridor "
            "and time window. Sparse or missing AIS may hide relevant vessels; "
            "attribution cannot proceed."
        ),
    }


def resolve_suspect_search_parameters(
    detected_at: datetime | None = None,
    drift_hours_assumed: float | int | str | None = None,
    estimated_discharge_at: datetime | None = None,
    origin_lat: float | None = None,
    origin_lon: float | None = None,
) -> dict:
    """Resolve the heuristic AIS search window around the estimated release.

    When a spill has a stored discharge estimate, it should drive the candidate
    search window. If no estimate exists, fall back to the configured drift
    time. The ±1-hour window is an operational filter, not calibrated
    uncertainty.
    """
    if estimated_discharge_at is not None:
        origin_time = estimated_discharge_at
    elif detected_at is not None:
        hours = float(drift_hours_assumed) if drift_hours_assumed not in (None, "") else 6.0
        origin_time = detected_at - timedelta(hours=hours)
    else:
        origin_time = None

    t_start = (
        origin_time - timedelta(hours=AIS_ORIGIN_TIME_BUFFER_HOURS)
        if origin_time is not None
        else None
    )
    if origin_time is None:
        t_end = None
    else:
        t_end = origin_time + timedelta(hours=AIS_ORIGIN_TIME_BUFFER_HOURS)
        if detected_at is not None:
            t_end = min(t_end, detected_at)

    return {
        "origin_time": origin_time,
        "t_start": t_start,
        "t_end": t_end,
        "origin_lat": origin_lat,
        "origin_lon": origin_lon,
    }


def origin_corridor_radius_m(area_km2: float | int | None) -> int:
    """Return the existing area-tiered operational search radius in metres."""
    area = float(area_km2 or 0.0)
    first_threshold, first_radius = SPILL_AREA_BUFFER_TIERS_KM[0]
    if area < first_threshold:
        return int(first_radius * 1000)
    for max_area_km2, radius_km in SPILL_AREA_BUFFER_TIERS_KM[1:]:
        if area <= max_area_km2:
            return int(radius_km * 1000)
    return int(SPILL_AREA_BUFFER_TIERS_KM[-1][1] * 1000)


# Input: one bound parameter, spill_id (integer). Never interpolate this
# with f-strings/.format()/+ concatenation -- that reopens SQL injection.
QUERY_TEXT = """
WITH params AS (
  SELECT s.id AS spill_id, s.geom AS spill_geom, s.detected_at AS t_sat,
    COALESCE(%(t_start)s::timestamptz, s.detected_at - INTERVAL '6 hours') AS t_start,
    COALESCE(%(t_end)s::timestamptz, s.detected_at) AS t_end,
    COALESCE(%(origin_time)s::timestamptz, s.detected_at - INTERVAL '6 hours') AS origin_time,
    CASE
      WHEN %(origin_lat)s IS NOT NULL AND %(origin_lon)s IS NOT NULL THEN
        ST_SetSRID(ST_MakePoint(%(origin_lon)s::float, %(origin_lat)s::float), 4326)
      ELSE
        ST_Centroid(s.geom)
    END AS estimated_discharge_point
  FROM spill_events s
  WHERE s.id = %(spill_id)s
),
buffer_calc AS (
  SELECT p.*, %(corridor_radius_m)s::double precision AS corridor_radius_m
  FROM params p
),
ais_motion AS (
  SELECT ap.id, ap.mmsi, ap.ts, ap.geom,
    LAG(ap.ts) OVER w AS prev_ts,
    LAG(ap.geom) OVER w AS prev_geom,
    LEAD(ap.ts) OVER w AS next_ts,
    LEAD(ap.geom) OVER w AS next_geom
  FROM ais_positions ap
  CROSS JOIN buffer_calc b
  WHERE ap.ts BETWEEN
      b.t_start - make_interval(hours => %(heading_gap_hours)s::integer)
      AND b.t_end + make_interval(hours => %(heading_gap_hours)s::integer)
    AND COALESCE(ap.is_test, FALSE) = FALSE
  WINDOW w AS (PARTITION BY ap.mmsi ORDER BY ap.ts, ap.id)
),
candidates AS (
  SELECT
    v.mmsi, v.name, b.spill_id, ap.ts,
    b.t_start AS ais_search_start,
    b.t_end AS ais_search_end,
    b.corridor_radius_m / 1000.0 AS origin_corridor_radius_km,
    ST_Distance(ap.geom::geography, b.estimated_discharge_point::geography) AS distance_meters,
    EXTRACT(EPOCH FROM (b.t_sat - ap.ts)) / 3600.0 AS hours_before_detection,
    ABS(EXTRACT(EPOCH FROM (ap.ts - b.origin_time)) / 3600.0) AS hours_from_estimated_origin,
    EXP(-ST_Distance(ap.geom::geography, b.estimated_discharge_point::geography) / 5000.0) AS proximity_score,
    EXP(-POWER(ABS(EXTRACT(EPOCH FROM (ap.ts - b.origin_time)) / 3600.0), 2)
      / (2 * POWER(%(time_buffer_hours)s::double precision, 2))) AS time_score,
    CASE
      WHEN ap.prev_ts IS NOT NULL
       AND ap.ts > ap.prev_ts
       AND EXTRACT(EPOCH FROM (ap.ts - ap.prev_ts)) / 3600.0 <= %(heading_gap_hours)s
      THEN DEGREES(ST_Azimuth(ap.prev_geom, ap.geom))
      WHEN ap.next_ts IS NOT NULL
       AND ap.next_ts > ap.ts
       AND EXTRACT(EPOCH FROM (ap.next_ts - ap.ts)) / 3600.0 <= %(heading_gap_hours)s
      THEN DEGREES(ST_Azimuth(ap.geom, ap.next_geom))
      ELSE NULL
    END AS heading_deg,
    CASE
      WHEN (
        (ap.prev_ts IS NOT NULL
         AND ap.ts > ap.prev_ts
         AND EXTRACT(EPOCH FROM (ap.ts - ap.prev_ts)) / 3600.0 <= %(heading_gap_hours)s)
        OR
        (ap.next_ts IS NOT NULL
         AND ap.next_ts > ap.ts
         AND EXTRACT(EPOCH FROM (ap.next_ts - ap.ts)) / 3600.0 <= %(heading_gap_hours)s)
      )
       AND ST_Distance(b.estimated_discharge_point::geography, ST_Centroid(b.spill_geom)::geography) > 0
      THEN ABS(COS(RADIANS(
        CASE
          WHEN ap.prev_ts IS NOT NULL
           AND ap.ts > ap.prev_ts
           AND EXTRACT(EPOCH FROM (ap.ts - ap.prev_ts)) / 3600.0 <= %(heading_gap_hours)s
          THEN DEGREES(ST_Azimuth(ap.prev_geom, ap.geom))
          ELSE DEGREES(ST_Azimuth(ap.geom, ap.next_geom))
        END
        - DEGREES(ST_Azimuth(b.estimated_discharge_point, ST_Centroid(b.spill_geom)))
      )))
      ELSE NULL
    END AS heading_alignment_score
  FROM ais_motion ap
  JOIN vessels v ON v.mmsi = ap.mmsi
  CROSS JOIN buffer_calc b
  WHERE ap.ts BETWEEN b.t_start AND b.t_end
    AND COALESCE(v.is_test, FALSE) = FALSE
    AND ST_DWithin(
      ap.geom::geography,
      b.estimated_discharge_point::geography,
      b.corridor_radius_m
    )
),
best_per_vessel AS (
  SELECT DISTINCT ON (mmsi)
    mmsi, name, spill_id, ts, ais_search_start, ais_search_end,
    origin_corridor_radius_km, distance_meters, hours_before_detection,
    hours_from_estimated_origin, proximity_score, time_score, heading_deg,
    heading_alignment_score
  FROM candidates
  ORDER BY mmsi, (proximity_score * time_score) DESC
),
gap_info AS (
  SELECT DISTINCT ON (mmsi) mmsi, TRUE AS has_suspicious_gap, gap_duration_hours
  FROM ais_suspicious_gaps ORDER BY mmsi, gap_duration_hours DESC
),
speed_info AS (
  SELECT DISTINCT mmsi, TRUE AS has_speed_anomaly
  FROM ais_speed_anomalies WHERE is_speed_anomaly = TRUE
),
docking_info AS (
  SELECT mmsi, ts, is_legitimately_docked FROM vessel_docking_status
)
SELECT
  bp.mmsi, bp.name,
  ROUND(bp.distance_meters::numeric / 1000.0, 2) AS distance_km,
  ROUND(bp.hours_before_detection::numeric, 1) AS hours_before_detection,
  ROUND(bp.hours_from_estimated_origin::numeric, 2) AS hours_from_estimated_origin,
  bp.ais_search_start,
  bp.ais_search_end,
  ROUND(bp.origin_corridor_radius_km::numeric, 1) AS origin_corridor_radius_km,
  ROUND((bp.proximity_score * 100)::numeric, 1) AS proximity_score,
  ROUND((bp.time_score * 100)::numeric, 1) AS time_score,
  ROUND(bp.heading_deg::numeric, 1) AS heading_deg,
  ROUND((bp.heading_alignment_score * 100)::numeric, 1) AS heading_alignment_score,
  bp.heading_alignment_score IS NOT NULL AS heading_evidence_available,
  COALESCE(vt.type_score, 40) AS type_score,
  COALESCE(g.has_suspicious_gap, FALSE) AS has_suspicious_gap,
  CASE WHEN g.has_suspicious_gap THEN 100 ELSE 0 END AS gap_score,
  COALESCE(sp.has_speed_anomaly, FALSE) AS has_speed_anomaly,
  CASE WHEN sp.has_speed_anomaly THEN 100 ELSE 0 END AS speed_anomaly_score,
  COALESCE(dk.is_legitimately_docked, FALSE) AS is_legitimately_docked,
  ROUND(
    (
      (
        100 * (
          (bp.proximity_score * bp.time_score) * 0.35 +
          (COALESCE(vt.type_score, 40) / 100.0) * 0.15 +
          (CASE WHEN g.has_suspicious_gap THEN 1.0 ELSE 0.0 END) * 0.20 +
          (CASE WHEN sp.has_speed_anomaly THEN 1.0 ELSE 0.0 END) * 0.15 +
          COALESCE(bp.heading_alignment_score, 0.0) * 0.15
        ) / CASE WHEN bp.heading_alignment_score IS NULL THEN 0.85 ELSE 1.0 END
      )
      * (CASE WHEN dk.is_legitimately_docked THEN 0.3 ELSE 1.0 END)
    )::numeric
  , 1) AS final_score,
  ARRAY_REMOVE(ARRAY[
    CASE WHEN vt.ais_type BETWEEN 80 AND 89 THEN 'Tanker' END,
    CASE WHEN vt.ais_type BETWEEN 70 AND 79 THEN 'Cargo vessel' END,
    CASE WHEN vt.ais_type BETWEEN 60 AND 69 THEN 'Passenger vessel (low priority)' END,
    CASE WHEN vt.ais_type IS NULL THEN 'Unknown vessel type' END,
    CASE WHEN bp.distance_meters < 1000 THEN 'AIS position within 1 km of estimated origin' END,
    CASE WHEN bp.heading_alignment_score IS NOT NULL THEN
      'Course-to-origin-axis alignment is heuristic evidence, not proof' END,
    CASE WHEN g.has_suspicious_gap THEN
      'Suspicious ' || ROUND(g.gap_duration_hours::numeric, 1) || 'h AIS gap near spill zone' END,
    CASE WHEN sp.has_speed_anomaly THEN 'Unusual speed change detected' END,
    CASE WHEN dk.is_legitimately_docked THEN 'Legitimately docked in port zone (deprioritized)' END
  ], NULL) AS flags
FROM best_per_vessel bp
LEFT JOIN vessel_type_weights vt ON vt.mmsi = bp.mmsi
LEFT JOIN gap_info g ON g.mmsi = bp.mmsi
LEFT JOIN speed_info sp ON sp.mmsi = bp.mmsi
LEFT JOIN docking_info dk ON dk.mmsi = bp.mmsi AND dk.ts = bp.ts
ORDER BY final_score DESC;
"""


def get_suspects(
    spill_id: int,
    origin_lat: float | None = None,
    origin_lon: float | None = None,
) -> list[dict]:
    """
    Returns ranked suspect vessels for a spill as a list of dicts.
    Uses the spill's stored estimated discharge time/origin when available,
    otherwise falls back to the passed-in coordinates or the centroid-based default.
    """
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT s.detected_at,
                   ST_Area(s.geom::geography) / 1000000.0 AS area_km2,
                   r.estimated_discharge_at,
                   r.drift_hours_assumed,
                   r.origin_lat,
                   r.origin_lon
            FROM spill_events s
            LEFT JOIN reverse_drift_estimates r ON r.spill_id = s.id
            WHERE s.id = %(spill_id)s
            """,
            {"spill_id": spill_id},
        )
        row = cur.fetchone()
        cur.close()

        if row is None:
            return []

        detected_at, area_km2, estimated_discharge_at, drift_hours_assumed, stored_origin_lat, stored_origin_lon = row
        resolved_origin_lat = origin_lat if origin_lat is not None else stored_origin_lat
        resolved_origin_lon = origin_lon if origin_lon is not None else stored_origin_lon
        search_params = resolve_suspect_search_parameters(
            detected_at=detected_at,
            drift_hours_assumed=drift_hours_assumed,
            estimated_discharge_at=estimated_discharge_at,
            origin_lat=resolved_origin_lat,
            origin_lon=resolved_origin_lon,
        )
        corridor_radius_m = origin_corridor_radius_m(area_km2)

        coverage_query = """
            SELECT COUNT(*) AS candidate_rows, COUNT(DISTINCT ap.mmsi) AS distinct_mmsi
            FROM ais_positions ap
            JOIN vessels v ON v.mmsi = ap.mmsi
            CROSS JOIN (
                SELECT CASE
                    WHEN %(origin_lat)s IS NOT NULL AND %(origin_lon)s IS NOT NULL THEN
                        ST_SetSRID(ST_MakePoint(%(origin_lon)s::float, %(origin_lat)s::float), 4326)
                    ELSE ST_Centroid(s.geom)
                END AS origin_point
                FROM spill_events s
                WHERE s.id = %(spill_id)s
            ) origin
            WHERE ap.ts BETWEEN %(t_start)s AND %(t_end)s
              AND COALESCE(ap.is_test, FALSE) = FALSE
              AND COALESCE(v.is_test, FALSE) = FALSE
              AND ST_DWithin(
                  ap.geom::geography,
                  origin.origin_point::geography,
                  %(corridor_radius_m)s
              )
        """
        cur = conn.cursor()
        cur.execute(coverage_query, {
            "spill_id": spill_id,
            "t_start": search_params["t_start"],
            "t_end": search_params["t_end"],
            "origin_lat": search_params["origin_lat"],
            "origin_lon": search_params["origin_lon"],
            "corridor_radius_m": corridor_radius_m,
        })
        coverage_rows = cur.fetchone()
        coverage_status = evaluate_ais_coverage(coverage_rows[0], coverage_rows[1])
        if not coverage_status["coverage_ok"]:
            raise AISCoverageError(coverage_status["message"])

        cur = conn.cursor()
        cur.execute(
            QUERY_TEXT,
            {
                "spill_id": spill_id,
                "t_start": search_params["t_start"],
                "t_end": search_params["t_end"],
                "origin_time": search_params["origin_time"],
                "time_buffer_hours": AIS_ORIGIN_TIME_BUFFER_HOURS,
                "corridor_radius_m": corridor_radius_m,
                "heading_gap_hours": AIS_HEADING_MAX_PING_GAP_HOURS,
                "origin_lat": search_params["origin_lat"],
                "origin_lon": search_params["origin_lon"],
            },
        )
        columns = [desc[0] for desc in cur.description]
        rows = [dict(zip(columns, row)) for row in cur.fetchall()]
        cur.close()
        return rows
    finally:
        conn.close()
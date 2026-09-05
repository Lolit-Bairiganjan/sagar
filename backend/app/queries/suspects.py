"""
suspects.py — Runs the finalized spatio-temporal suspect-scoring query
for a given spill and returns ranked candidate vessels.
"""

from app.db import get_connection

# Input: one bound parameter, spill_id (integer). Never interpolate this
# with f-strings/.format()/+ concatenation -- that reopens SQL injection.
QUERY_TEXT = """
WITH params AS (
  SELECT s.id AS spill_id, s.geom AS spill_geom, s.detected_at AS t_sat,
    ST_Area(s.geom::geography) / 1000000.0 AS area_km2,
    (s.detected_at - INTERVAL '6 hours') AS t_start
  FROM spill_events s
  WHERE s.id = %(spill_id)s
),
drift_adj AS (
  SELECT p.spill_id,
    COALESCE(
      ST_Project(
        ST_Centroid(p.spill_geom)::geography,
        rde.total_drift_distance_km * 1000,
        radians((rde.combined_drift_direction_deg + 180) %% 360)
      )::geometry,
      p.spill_geom
    ) AS estimated_discharge_point
  FROM params p
  LEFT JOIN reverse_drift_estimates rde ON rde.spill_id = p.spill_id
),
buffer_calc AS (
  SELECT p.*, d.estimated_discharge_point,
    CASE WHEN p.area_km2 < 1 THEN 5000 WHEN p.area_km2 <= 10 THEN 10000 ELSE 25000 END AS buffer_meters,
    3.0 AS time_center_hours
  FROM params p JOIN drift_adj d ON d.spill_id = p.spill_id
),
candidates AS (
  SELECT
    v.mmsi, v.name, b.spill_id, ap.ts,
    LEAST(
      ST_Distance(ap.geom::geography, b.spill_geom::geography),
      ST_Distance(ap.geom::geography, b.estimated_discharge_point::geography)
    ) AS distance_meters,
    EXTRACT(EPOCH FROM (b.t_sat - ap.ts)) / 3600.0 AS hours_before_detection,
    EXP(-LEAST(
      ST_Distance(ap.geom::geography, b.spill_geom::geography),
      ST_Distance(ap.geom::geography, b.estimated_discharge_point::geography)
    ) / 5000.0) AS proximity_score,
    EXP(-POWER(EXTRACT(EPOCH FROM (b.t_sat - ap.ts)) / 3600.0 - 3.0, 2) / (2 * POWER(2.0, 2))) AS time_score
  FROM ais_positions ap
  JOIN vessels v ON v.mmsi = ap.mmsi
  CROSS JOIN buffer_calc b
  WHERE ap.ts BETWEEN b.t_start AND b.t_sat
    AND (
      ST_DWithin(ap.geom::geography, b.spill_geom::geography, b.buffer_meters)
      OR ST_DWithin(ap.geom::geography, b.estimated_discharge_point::geography, b.buffer_meters)
    )
),
best_per_vessel AS (
  SELECT DISTINCT ON (mmsi)
    mmsi, name, spill_id, ts, distance_meters, hours_before_detection, proximity_score, time_score
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
  ROUND((bp.proximity_score * 100)::numeric, 1) AS proximity_score,
  ROUND((bp.time_score * 100)::numeric, 1) AS time_score,
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
          (CASE WHEN sp.has_speed_anomaly THEN 1.0 ELSE 0.0 END) * 0.15
        ) / 0.85
      )
      * (CASE WHEN dk.is_legitimately_docked THEN 0.3 ELSE 1.0 END)
    )::numeric
  , 1) AS final_score,
  ARRAY_REMOVE(ARRAY[
    CASE WHEN vt.ais_type BETWEEN 80 AND 89 THEN 'Tanker' END,
    CASE WHEN vt.ais_type BETWEEN 70 AND 79 THEN 'Cargo vessel' END,
    CASE WHEN vt.ais_type BETWEEN 60 AND 69 THEN 'Passenger vessel (low priority)' END,
    CASE WHEN vt.ais_type IS NULL THEN 'Unknown vessel type' END,
    CASE WHEN bp.distance_meters < 1000 THEN 'Entered spill/discharge zone directly' END,
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


def get_suspects(spill_id: int) -> list[dict]:
    """
    Returns ranked suspect vessels for a spill as a list of dicts.
    An empty list is a normal, valid outcome (no suspects found).
    """
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(QUERY_TEXT, {"spill_id": spill_id})
        columns = [desc[0] for desc in cur.description]
        rows = [dict(zip(columns, row)) for row in cur.fetchall()]
        cur.close()
        return rows
    finally:
        conn.close()
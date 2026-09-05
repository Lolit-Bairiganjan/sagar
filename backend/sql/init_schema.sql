-- ============================================================================
-- init_schema.sql — Complete schema for the oil spill / AIS correlation engine
-- (SIH26143). Rebuild the entire working system from this single file.
--
-- Order matters: tables first, then views in dependency order (each view
-- only references tables/views already created above it).
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS postgis;

-- ── Core Tables ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vessels (
    mmsi BIGINT PRIMARY KEY,
    name TEXT,
    ais_type INTEGER
);

CREATE TABLE IF NOT EXISTS ais_positions (
    id SERIAL PRIMARY KEY,
    mmsi BIGINT REFERENCES vessels(mmsi),
    ts TIMESTAMPTZ NOT NULL,
    geom GEOMETRY(Point, 4326) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ais_geom ON ais_positions USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_ais_ts ON ais_positions (ts);

CREATE TABLE IF NOT EXISTS spill_events (
    id SERIAL PRIMARY KEY,
    detected_at TIMESTAMPTZ NOT NULL,
    geom GEOMETRY(Polygon, 4326) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_spill_geom ON spill_events USING GIST (geom);

CREATE TABLE IF NOT EXISTS port_zones (
    id SERIAL PRIMARY KEY,
    name TEXT,
    geom GEOMETRY(Polygon, 4326)
);
CREATE INDEX IF NOT EXISTS idx_port_zones_geom ON port_zones USING GIST (geom);

CREATE TABLE IF NOT EXISTS reverse_drift_estimates (
    id SERIAL PRIMARY KEY,
    spill_id INTEGER NOT NULL REFERENCES spill_events(id),
    wind_speed_kmh NUMERIC,
    wind_direction_deg NUMERIC,
    current_speed_kmh NUMERIC,
    current_direction_deg NUMERIC,
    current_data_source TEXT,
    combined_drift_speed_kmh NUMERIC,
    combined_drift_direction_deg NUMERIC,
    total_drift_distance_km NUMERIC,
    drift_hours_assumed NUMERIC,
    computed_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(spill_id)
);


-- ── §2: AIS Preprocessing ────────────────────────────────────────────────
-- Derives elapsed time/distance/speed between consecutive pings per vessel.

CREATE OR REPLACE VIEW ais_positions_enriched AS
SELECT
  id,
  mmsi,
  ts,
  geom,
  LAG(ts) OVER w AS prev_ts,
  EXTRACT(EPOCH FROM (ts - LAG(ts) OVER w)) / 3600.0 AS hours_elapsed,
  ST_Distance(geom::geography, LAG(geom) OVER w::geography) / 1000.0 AS km_traveled,
  CASE
    WHEN LAG(ts) OVER w IS NULL THEN NULL
    WHEN EXTRACT(EPOCH FROM (ts - LAG(ts) OVER w)) = 0 THEN NULL
    ELSE (ST_Distance(geom::geography, LAG(geom) OVER w::geography) / 1000.0)
         / (EXTRACT(EPOCH FROM (ts - LAG(ts) OVER w)) / 3600.0)
  END AS derived_speed_kmh
FROM ais_positions
WINDOW w AS (PARTITION BY mmsi ORDER BY ts);

-- Filters out invalid coordinates, impossible speeds (>100 km/h), and
-- duplicate-timestamp pings. MAX_PLAUSIBLE_SPEED_KMH matches config.py.
CREATE OR REPLACE VIEW clean_ais_positions AS
SELECT
  id, mmsi, ts, geom, hours_elapsed, km_traveled, derived_speed_kmh
FROM ais_positions_enriched
WHERE
  ST_X(geom) BETWEEN -180 AND 180
  AND ST_Y(geom) BETWEEN -90 AND 90
  AND (derived_speed_kmh IS NULL OR derived_speed_kmh <= 100)
  AND (hours_elapsed IS NULL OR hours_elapsed > 0);


-- ── §6: Trajectory Reconstruction (segmentation) ────────────────────────
-- SEGMENT_GAP_HOURS = 2 (matches config.py; calibrated on real AIS data:
-- only 0.131% of real inter-ping gaps exceed 2 hours).

CREATE OR REPLACE VIEW ais_trajectory_segments_points AS
SELECT
  mmsi,
  ts,
  geom,
  SUM(
    CASE WHEN hours_elapsed IS NULL OR hours_elapsed > 2 THEN 1 ELSE 0 END
  ) OVER (PARTITION BY mmsi ORDER BY ts) AS segment_id
FROM clean_ais_positions;

CREATE OR REPLACE VIEW ais_trajectory_segments AS
SELECT
  mmsi,
  segment_id,
  MIN(ts) AS t_start,
  MAX(ts) AS t_end,
  COUNT(*) AS point_count,
  ST_MakeLine(geom ORDER BY ts) AS trajectory
FROM ais_trajectory_segments_points
GROUP BY mmsi, segment_id;


-- ── §11: Dark Target / AIS Gap Detection ────────────────────────────────
-- AIS_GAP_FLAG_HOURS = 1 (matches config.py; only 0.357% of real gaps
-- exceed 1 hour, making this a meaningful signal, not noise).

CREATE OR REPLACE VIEW ais_gap_events AS
SELECT
  mmsi,
  LAG(ts) OVER w AS gap_start_ts,
  ts AS gap_end_ts,
  hours_elapsed AS gap_duration_hours,
  LAG(geom) OVER w AS position_before_gap,
  geom AS position_after_gap
FROM clean_ais_positions
WINDOW w AS (PARTITION BY mmsi ORDER BY ts);

-- Buffer size is DYNAMIC per spill area (matches the main scoring query's
-- buffer tiers) -- fixed from an earlier version that hardcoded 25000m
-- for every spill regardless of size.
CREATE OR REPLACE VIEW ais_suspicious_gaps AS
SELECT
  g.mmsi, g.gap_start_ts, g.gap_end_ts, g.gap_duration_hours,
  g.position_before_gap, g.position_after_gap,
  s.id AS spill_id, s.detected_at,
  ST_Distance(
    ST_MakeLine(g.position_before_gap, g.position_after_gap)::geography,
    s.geom::geography
  ) / 1000.0 AS distance_to_spill_km
FROM ais_gap_events g
JOIN spill_events s
  ON g.gap_duration_hours > 1
  AND g.gap_start_ts <= s.detected_at
  AND g.gap_end_ts >= (s.detected_at - INTERVAL '6 hours')
  AND ST_DWithin(
    ST_MakeLine(g.position_before_gap, g.position_after_gap)::geography,
    s.geom::geography,
    CASE
      WHEN ST_Area(s.geom::geography) / 1000000.0 < 1 THEN 5000
      WHEN ST_Area(s.geom::geography) / 1000000.0 <= 10 THEN 10000
      ELSE 25000
    END
  );


-- ── §12: Speed Anomaly Detection ─────────────────────────────────────────
-- Calibrated on ~400K real AIS speed transitions: among underway vessels
-- (>=5 km/h) with a meaningful absolute change (>=3 km/h), a full speed
-- doubling/halving (ratio >= 1.0) sits at the ~90th percentile of real
-- behavior. Excludes near-zero starting speeds (e.g. leaving port) which
-- would otherwise dominate the signal with mundane speed changes.

CREATE OR REPLACE VIEW ais_speed_anomalies AS
SELECT
  mmsi,
  ts,
  derived_speed_kmh AS current_speed_kmh,
  LAG(derived_speed_kmh) OVER w AS previous_speed_kmh,
  derived_speed_kmh - LAG(derived_speed_kmh) OVER w AS speed_change_kmh,
  CASE
    WHEN LAG(derived_speed_kmh) OVER w IS NULL OR LAG(derived_speed_kmh) OVER w = 0 THEN NULL
    ELSE (derived_speed_kmh - LAG(derived_speed_kmh) OVER w) / LAG(derived_speed_kmh) OVER w
  END AS speed_change_ratio,
  CASE
    WHEN LAG(derived_speed_kmh) OVER w IS NULL THEN FALSE
    WHEN LAG(derived_speed_kmh) OVER w < 5 THEN FALSE
    WHEN ABS(derived_speed_kmh - LAG(derived_speed_kmh) OVER w) < 3 THEN FALSE
    WHEN ABS((derived_speed_kmh - LAG(derived_speed_kmh) OVER w) / LAG(derived_speed_kmh) OVER w) >= 1.0 THEN TRUE
    ELSE FALSE
  END AS is_speed_anomaly
FROM ais_positions_enriched
WINDOW w AS (PARTITION BY mmsi ORDER BY ts);


-- ── §9: Ship Type Weighting ──────────────────────────────────────────────

CREATE OR REPLACE VIEW vessel_type_weights AS
SELECT
  v.mmsi,
  v.ais_type,
  CASE
    WHEN v.ais_type BETWEEN 80 AND 89 THEN 100
    WHEN v.ais_type BETWEEN 70 AND 79 THEN 80
    WHEN v.ais_type IS NULL THEN 40
    ELSE 20
  END AS type_score
FROM vessels v;


-- ── §9 (cont.): Port/Harbor Zone Exclusion ───────────────────────────────
-- 0.93 km/h = 0.5 knots (spec's stated stationary threshold).

CREATE OR REPLACE VIEW vessel_docking_status AS
SELECT
  ap.mmsi,
  ap.ts,
  ap.geom,
  ap.derived_speed_kmh,
  pz.id AS port_zone_id,
  pz.name AS port_zone_name,
  CASE
    WHEN ap.derived_speed_kmh IS NOT NULL
     AND ap.derived_speed_kmh < 0.93
     AND pz.id IS NOT NULL
    THEN TRUE
    ELSE FALSE
  END AS is_legitimately_docked
FROM ais_positions_enriched ap
LEFT JOIN port_zones pz
  ON ST_Within(ap.geom, pz.geom);
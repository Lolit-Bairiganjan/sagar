CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS vessels (
    mmsi BIGINT PRIMARY KEY,
    name TEXT
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
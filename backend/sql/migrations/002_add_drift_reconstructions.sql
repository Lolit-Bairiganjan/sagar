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
CREATE INDEX IF NOT EXISTS idx_reconstruction_runs_spill_created
    ON reconstruction_runs (spill_id, created_at DESC);

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
CREATE INDEX IF NOT EXISTS idx_reconstruction_frames_run_time
    ON reconstruction_frames (run_id, timestamp_utc);

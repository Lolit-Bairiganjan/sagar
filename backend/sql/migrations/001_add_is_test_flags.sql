ALTER TABLE IF EXISTS vessels
    ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE IF EXISTS ais_positions
    ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE IF EXISTS reverse_drift_estimates
    ADD COLUMN IF NOT EXISTS estimated_discharge_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS origin_lat NUMERIC,
    ADD COLUMN IF NOT EXISTS origin_lon NUMERIC;

CREATE INDEX IF NOT EXISTS idx_vessels_is_test ON vessels (is_test);
CREATE INDEX IF NOT EXISTS idx_ais_is_test_ts ON ais_positions (is_test, ts);

UPDATE vessels SET is_test = FALSE WHERE is_test IS NULL;
UPDATE ais_positions SET is_test = FALSE WHERE is_test IS NULL;
UPDATE reverse_drift_estimates SET estimated_discharge_at = NOW() WHERE estimated_discharge_at IS NULL AND drift_hours_assumed IS NOT NULL;

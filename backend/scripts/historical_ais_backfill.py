#!/usr/bin/env python3
"""Historical AIS verification and backfill utility.

Purpose:
- validate whether a historical spill has enough AIS coverage in the exact
  incident window before suspect attribution runs
- optionally bulk-load AIS positions from a CSV file into ais_positions

Expected CSV columns:
  mmsi,lat,lon,ts

Example:
  python scripts/historical_ais_backfill.py --spill-id 60
  python scripts/historical_ais_backfill.py --spill-id 60 --csv historical_ais.csv
"""

from __future__ import annotations

import argparse
import csv
import sys
from pathlib import Path

from app.db import get_connection


def get_spill_window(spill_id: int):
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT s.id,
                   s.detected_at,
                   r.estimated_discharge_at,
                   r.drift_hours_assumed,
                   r.origin_lat,
                   r.origin_lon,
                   ST_AsText(s.geom)
            FROM spill_events s
            LEFT JOIN reverse_drift_estimates r ON r.spill_id = s.id
            WHERE s.id = %s
            """,
            (spill_id,),
        )
        row = cur.fetchone()
        cur.close()
        return row
    finally:
        conn.close()


def check_ais_coverage(spill_id: int):
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT COUNT(*) AS candidate_rows,
                   COUNT(DISTINCT ap.mmsi) AS distinct_mmsi
            FROM ais_positions ap
            JOIN spill_events s ON s.id = %s
            WHERE ap.ts BETWEEN COALESCE(
                    (SELECT r.estimated_discharge_at
                     FROM reverse_drift_estimates r
                     WHERE r.spill_id = %s),
                    s.detected_at - INTERVAL '6 hours'
                ) AND s.detected_at
              AND COALESCE(ap.is_test, FALSE) = FALSE
              AND (
                    ST_DWithin(ap.geom::geography, s.geom::geography, 50000)
                    OR ST_DWithin(ap.geom::geography, ST_Centroid(s.geom)::geography, 50000)
              )
            """,
            (spill_id, spill_id),
        )
        row = cur.fetchone()
        cur.close()
        return {"candidate_rows": int(row[0] or 0), "distinct_mmsi": int(row[1] or 0)}
    finally:
        conn.close()


def load_csv_rows(csv_path: str, source_name: str = "csv") -> int:
    path = Path(csv_path)
    if not path.exists():
        raise FileNotFoundError(f"CSV file not found: {csv_path}")

    rows_loaded = 0
    conn = get_connection()
    try:
        cur = conn.cursor()
        with path.open("r", encoding="utf-8", newline="") as fh:
            reader = csv.DictReader(fh)
            required = {"mmsi", "lat", "lon", "ts"}
            missing = required - set((reader.fieldnames or []))
            if missing:
                raise ValueError(f"CSV missing required columns: {sorted(missing)}")

            for row in reader:
                mmsi = int(float(row["mmsi"]))
                lat = float(row["lat"])
                lon = float(row["lon"])
                ts = row["ts"].strip()
                cur.execute(
                    """
                    INSERT INTO ais_positions (mmsi, geom, ts, is_test)
                    VALUES (%s, ST_SetSRID(ST_Point(%s, %s), 4326), %s, FALSE)
                    ON CONFLICT DO NOTHING
                    """,
                    (mmsi, lon, lat, ts),
                )
                rows_loaded += 1

        conn.commit()
        cur.close()
        print(f"Loaded {rows_loaded} AIS rows from {source_name} ({csv_path})")
        return rows_loaded
    finally:
        conn.close()


def main():
    parser = argparse.ArgumentParser(description="Validate or backfill historical AIS coverage for a spill.")
    parser.add_argument("--spill-id", type=int, required=True, help="Spill ID to validate")
    parser.add_argument("--csv", type=str, default=None, help="Optional CSV file with mmsi,lat,lon,ts rows to load")
    args = parser.parse_args()

    window = get_spill_window(args.spill_id)
    if window is None:
        print(f"No spill found for spill_id={args.spill_id}")
        return 1

    print("Spill window:")
    print(window)

    if args.csv:
        try:
            load_csv_rows(args.csv, source_name="CSV")
        except Exception as exc:
            print(f"Backfill failed: {exc}", file=sys.stderr)
            return 2

    coverage = check_ais_coverage(args.spill_id)
    print("AIS coverage:")
    print(coverage)

    if coverage["candidate_rows"] > 0 and coverage["distinct_mmsi"] > 0:
        print("Coverage check passed: suspect ranking can proceed.")
        return 0

    print("Coverage check failed: no usable AIS coverage in the spill window.")
    return 3


if __name__ == "__main__":
    raise SystemExit(main())

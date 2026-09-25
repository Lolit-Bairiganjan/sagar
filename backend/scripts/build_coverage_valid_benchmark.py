#!/usr/bin/env python3
"""Build a coverage-valid benchmark seed from the live database.

This script inspects all spill_events and keeps only incident rows where the
backend's own AIS coverage gate passes. The output is a CSV seed intended for
manual ground-truth labeling later; it is not treated as a fully validated
benchmark until each case has a known culprit.
"""

from __future__ import annotations

import csv
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from app.db import get_connection
from app.queries.suspects import AISCoverageError, get_suspects

load_dotenv(ROOT / ".env")

CSV_PATH = ROOT / "scripts" / "coverage_valid_benchmark_seed.csv"


def get_all_spills() -> list[int]:
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT id FROM spill_events ORDER BY detected_at DESC")
        return [row[0] for row in cur.fetchall()]
    finally:
        conn.close()


def build_seed_csv() -> list[dict]:
    rows: list[dict] = []
    for spill_id in get_all_spills():
        try:
            suspects = get_suspects(spill_id)
        except AISCoverageError:
            continue
        except Exception:
            continue

        if not suspects:
            continue

        candidate_mmsis = ";".join(str(s.get("mmsi", "")) for s in suspects)
        rows.append({
            "incident_id": f"spill_{spill_id}",
            "incident_name": f"spill_{spill_id}",
            "detected_at": "",
            "actual_culprit_mmsi": "",
            "actual_culprit_name": "",
            "actual_origin_lat": "",
            "actual_origin_lon": "",
            "observed_area_km2": "",
            "candidate_mmsis": candidate_mmsis,
        })

    return rows


def main() -> int:
    records = build_seed_csv()
    fieldnames = [
        "incident_id",
        "incident_name",
        "detected_at",
        "actual_culprit_mmsi",
        "actual_culprit_name",
        "actual_origin_lat",
        "actual_origin_lon",
        "observed_area_km2",
        "candidate_mmsis",
    ]

    with CSV_PATH.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(records)

    print(f"Coverage-valid benchmark seed written to: {CSV_PATH}")
    print(f"Valid cases: {len(records)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

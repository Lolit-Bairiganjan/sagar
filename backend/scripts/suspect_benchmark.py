#!/usr/bin/env python3
"""Benchmark the suspect-ranking model against historical incident cases.

Expected CSV columns:
    incident_id,incident_name,detected_at,actual_culprit_mmsi,actual_culprit_name,
    actual_origin_lat,actual_origin_lon,observed_area_km2,candidate_mmsis

`candidate_mmsis` is a semicolon-separated list of ranked candidate MMSIs as returned
by the backend in order of suspicion. Example:
    123456789;987654321;456789123

This script computes Hit@1, Hit@3, Hit@5, average rank, and miss rate.
"""

from __future__ import annotations

import argparse
import csv
import math
from pathlib import Path


def parse_candidates(field: str | None) -> list[str]:
    if field is None or not str(field).strip():
        return []
    return [part.strip() for part in str(field).split(";") if part.strip()]


def evaluate_case(actual_mmsi: str | None, candidates: list[str]) -> dict:
    if actual_mmsi is None or str(actual_mmsi).strip() == "":
        return {
            "hit_1": False,
            "hit_3": False,
            "hit_5": False,
            "rank": None,
            "miss": True,
        }

    actual = str(actual_mmsi).strip()
    ranks = []
    for i, candidate in enumerate(candidates, start=1):
        if str(candidate).strip() == actual:
            ranks.append(i)
    if not ranks:
        return {
            "hit_1": False,
            "hit_3": False,
            "hit_5": False,
            "rank": None,
            "miss": True,
        }

    rank = min(ranks)
    return {
        "hit_1": rank == 1,
        "hit_3": rank <= 3,
        "hit_5": rank <= 5,
        "rank": rank,
        "miss": False,
    }


def evaluate_csv(csv_path: str) -> dict:
    path = Path(csv_path)
    if not path.exists():
        raise FileNotFoundError(f"CSV file not found: {csv_path}")

    rows = []
    with path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        required = {
            "incident_id",
            "incident_name",
            "detected_at",
            "actual_culprit_mmsi",
            "actual_culprit_name",
            "actual_origin_lat",
            "actual_origin_lon",
            "observed_area_km2",
            "candidate_mmsis",
        }
        missing = required - set(reader.fieldnames or [])
        if missing:
            raise ValueError(f"CSV missing required columns: {sorted(missing)}")

        for row in reader:
            mmsis = parse_candidates(row.get("candidate_mmsis"))
            outcome = evaluate_case(row.get("actual_culprit_mmsi"), mmsis)
            rows.append({
                "incident_id": row.get("incident_id", ""),
                "incident_name": row.get("incident_name", ""),
                "actual_culprit_mmsi": row.get("actual_culprit_mmsi", ""),
                "candidate_mmsis": mmsis,
                **outcome,
            })

    if not rows:
        raise ValueError("No valid rows found in benchmark CSV")

    total = len(rows)
    hit_1 = sum(1 for r in rows if r["hit_1"]) / total
    hit_3 = sum(1 for r in rows if r["hit_3"]) / total
    hit_5 = sum(1 for r in rows if r["hit_5"]) / total
    miss_rate = sum(1 for r in rows if r["miss"]) / total
    valid_ranks = [r["rank"] for r in rows if r["rank"] is not None]
    avg_rank = sum(valid_ranks) / len(valid_ranks) if valid_ranks else None

    return {
        "total_cases": total,
        "hit_1_rate": hit_1,
        "hit_3_rate": hit_3,
        "hit_5_rate": hit_5,
        "miss_rate": miss_rate,
        "average_rank": avg_rank,
        "rows": rows,
    }


def print_report(summary: dict) -> None:
    print("Suspect ranking benchmark report")
    print("=" * 40)
    print(f"Total benchmark cases: {summary['total_cases']}")
    print(f"Hit@1: {summary['hit_1_rate'] * 100:.1f}%")
    print(f"Hit@3: {summary['hit_3_rate'] * 100:.1f}%")
    print(f"Hit@5: {summary['hit_5_rate'] * 100:.1f}%")
    print(f"Miss rate: {summary['miss_rate'] * 100:.1f}%")
    print(f"Average rank of true culprit: {summary['average_rank'] if summary['average_rank'] is not None else 'N/A'}")
    print()
    for row in summary["rows"]:
        print(
            f"{row['incident_id']} | {row['incident_name']} | "
            f"culprit={row['actual_culprit_mmsi']} | rank={row['rank']} | "
            f"hit1={row['hit_1']} hit3={row['hit_3']} hit5={row['hit_5']} miss={row['miss']}"
        )


def main() -> int:
    parser = argparse.ArgumentParser(description="Evaluate suspect-list accuracy against known culprit vessels.")
    parser.add_argument("--csv", required=True, help="CSV file with benchmark incidents and candidate ranking order")
    args = parser.parse_args()

    try:
        summary = evaluate_csv(args.csv)
        print_report(summary)
        return 0
    except Exception as exc:  # pragma: no cover - CLI error path
        print(f"Benchmark failed: {exc}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

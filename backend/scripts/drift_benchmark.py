#!/usr/bin/env python3
"""Validate the drift backtrack heuristic against a benchmark CSV of real spill incidents.

Expected CSV columns:
    incident_id,incident_name,detected_at,actual_discharge_at,actual_origin_lat,actual_origin_lon,observed_area_km2,estimated_discharge_at,estimated_origin_lat,estimated_origin_lon

The file is intentionally kept simple and dependency-free so it can be run in the
backend environment without adding more packages.
"""

from __future__ import annotations

import argparse
import csv
import math
import statistics
from datetime import datetime
from pathlib import Path


def parse_iso(value: str | None) -> datetime | None:
    if value is None or not str(value).strip():
        return None
    cleaned = str(value).strip().replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(cleaned)
    except ValueError:
        return None


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    rlat1 = math.radians(lat1)
    rlon1 = math.radians(lon1)
    rlat2 = math.radians(lat2)
    rlon2 = math.radians(lon2)

    dlat = rlat2 - rlat1
    dlon = rlon2 - rlon1
    a = (
        math.sin(dlat / 2.0) ** 2
        + math.cos(rlat1) * math.cos(rlat2) * math.sin(dlon / 2.0) ** 2
    )
    c = 2.0 * math.asin(math.sqrt(a))
    return 6371.0 * c


def median(values: list[float]) -> float:
    if not values:
        return 0.0
    return float(statistics.median(values))


def pct(values: list[float], pct: float) -> float:
    if not values:
        return 0.0
    if len(values) == 1:
        return float(values[0])
    ordered = sorted(values)
    index = max(0, min(len(ordered) - 1, int(math.ceil(pct * len(ordered)) - 1)))
    return float(ordered[index])


def validate_csv(csv_path: str, hours_threshold: float, km_threshold: float, required_pass_rate: float) -> dict:
    path = Path(csv_path)
    if not path.exists():
        raise FileNotFoundError(f"CSV benchmark file not found: {csv_path}")

    rows = []
    with path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        required = {
            "incident_id",
            "incident_name",
            "detected_at",
            "actual_discharge_at",
            "actual_origin_lat",
            "actual_origin_lon",
            "observed_area_km2",
            "estimated_discharge_at",
            "estimated_origin_lat",
            "estimated_origin_lon",
        }
        missing = required - set(reader.fieldnames or [])
        if missing:
            raise ValueError(f"CSV missing required columns: {sorted(missing)}")

        for row in reader:
            actual_discharge = parse_iso(row.get("actual_discharge_at"))
            predicted_discharge = parse_iso(row.get("estimated_discharge_at"))
            actual_origin_lat = row.get("actual_origin_lat")
            actual_origin_lon = row.get("actual_origin_lon")
            pred_origin_lat = row.get("estimated_origin_lat")
            pred_origin_lon = row.get("estimated_origin_lon")

            if actual_discharge is None or predicted_discharge is None:
                continue
            if actual_origin_lat is None or actual_origin_lon is None:
                continue
            if pred_origin_lat is None or pred_origin_lon is None:
                continue

            try:
                act_lat = float(actual_origin_lat)
                act_lon = float(actual_origin_lon)
                pred_lat = float(pred_origin_lat)
                pred_lon = float(pred_origin_lon)
            except ValueError:
                continue

            time_error_hours = abs((predicted_discharge - actual_discharge).total_seconds() / 3600.0)
            distance_error_km = haversine_km(act_lat, act_lon, pred_lat, pred_lon)

            rows.append(
                {
                    "incident_id": row.get("incident_id", ""),
                    "incident_name": row.get("incident_name", ""),
                    "time_error_hours": time_error_hours,
                    "distance_error_km": distance_error_km,
                    "within_hour_threshold": time_error_hours <= hours_threshold,
                    "within_distance_threshold": distance_error_km <= km_threshold,
                }
            )

    if not rows:
        raise ValueError("No valid benchmark rows were found. Check the CSV data and timestamps.")

    time_errors = [r["time_error_hours"] for r in rows]
    distance_errors = [r["distance_error_km"] for r in rows]
    hour_pass = sum(1 for r in rows if r["within_hour_threshold"]) / len(rows)
    dist_pass = sum(1 for r in rows if r["within_distance_threshold"]) / len(rows)
    combined_pass = sum(1 for r in rows if r["within_hour_threshold"] and r["within_distance_threshold"]) / len(rows)

    return {
        "sample_count": len(rows),
        "mean_time_error_hours": sum(time_errors) / len(time_errors),
        "median_time_error_hours": median(time_errors),
        "p90_time_error_hours": pct(time_errors, 0.9),
        "max_time_error_hours": max(time_errors),
        "mean_distance_error_km": sum(distance_errors) / len(distance_errors),
        "median_distance_error_km": median(distance_errors),
        "p90_distance_error_km": pct(distance_errors, 0.9),
        "max_distance_error_km": max(distance_errors),
        "time_threshold_hours": hours_threshold,
        "distance_threshold_km": km_threshold,
        "pass_rate_time": hour_pass,
        "pass_rate_distance": dist_pass,
        "pass_rate_both": combined_pass,
        "required_pass_rate": required_pass_rate,
        "meets_time_threshold": hour_pass >= required_pass_rate,
        "meets_distance_threshold": dist_pass >= required_pass_rate,
        "meets_combined_threshold": combined_pass >= required_pass_rate,
        "rows": rows,
    }


def print_report(summary: dict) -> None:
    print("Drift benchmark validation report")
    print("=" * 40)
    print(f"Benchmark rows: {summary['sample_count']}")
    print(f"Mean abs time error: {summary['mean_time_error_hours']:.2f} h")
    print(f"Median abs time error: {summary['median_time_error_hours']:.2f} h")
    print(f"P90 abs time error: {summary['p90_time_error_hours']:.2f} h")
    print(f"Max abs time error: {summary['max_time_error_hours']:.2f} h")
    print()
    print(f"Mean distance error: {summary['mean_distance_error_km']:.2f} km")
    print(f"Median distance error: {summary['median_distance_error_km']:.2f} km")
    print(f"P90 distance error: {summary['p90_distance_error_km']:.2f} km")
    print(f"Max distance error: {summary['max_distance_error_km']:.2f} km")
    print()
    print(f"Within ±{summary['time_threshold_hours']}h: {summary['pass_rate_time'] * 100:.1f}%")
    print(f"Within ±{summary['distance_threshold_km']}km: {summary['pass_rate_distance'] * 100:.1f}%")
    print(f"Within both thresholds: {summary['pass_rate_both'] * 100:.1f}%")
    print()
    print(f"Required pass rate: {summary['required_pass_rate'] * 100:.1f}%")
    print(f"Time threshold met: {summary['meets_time_threshold']}")
    print(f"Distance threshold met: {summary['meets_distance_threshold']}")
    print(f"Combined threshold met: {summary['meets_combined_threshold']}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Benchmark the drift backtrack model against real spill incident data.")
    parser.add_argument("--csv", required=True, help="Path to the benchmark CSV file")
    parser.add_argument("--hours-threshold", type=float, default=6.0, help="Accepted time error threshold in hours")
    parser.add_argument("--km-threshold", type=float, default=10.0, help="Accepted origin distance error threshold in km")
    parser.add_argument("--required-pass-rate", type=float, default=0.9, help="Minimum pass rate threshold, e.g. 0.9 for 90%")
    args = parser.parse_args()

    try:
        summary = validate_csv(
            args.csv,
            hours_threshold=args.hours_threshold,
            km_threshold=args.km_threshold,
            required_pass_rate=args.required_pass_rate,
        )
        print_report(summary)
        return 0
    except Exception as exc:  # pragma: no cover - CLI error path
        print(f"Benchmark validation failed: {exc}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
"""Adversarial synthetic benchmark for the suspect-ranking pipeline.

This is intentionally designed to stress the project with failure modes that are
likely in free-tier / public-data conditions, not to show the model in its best light.

The benchmark is not a claim of real-world accuracy; it is a robustness validation.
It measures how often the real culprit is ranked in the suspect list under difficult
scenarios like missing AIS, decoy vessels, port activity, dark targets, origin drift,
and low-coverage windows.
"""

from __future__ import annotations

import csv
import math
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import List


@dataclass
class Vessel:
    mmsi: str
    name: str
    lat: float
    lon: float
    vessel_type: str
    speed_kn: float
    suspicious_gap: bool = False
    speed_anomaly: bool = False
    legitimately_docked: bool = False


@dataclass
class Case:
    incident_id: str
    incident_name: str
    detected_at: str
    actual_culprit_mmsi: str
    actual_culprit_name: str
    actual_origin_lat: float
    actual_origin_lon: float
    observed_area_km2: float
    vessels: List[Vessel]


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
    c = 2 * math.asin(math.sqrt(a))
    return 6371.0 * c


def vessel_score(distance_km: float, hours_before_detection: float, vessel: Vessel, culprit: bool) -> float:
    prox = max(0.0, 100.0 - distance_km * 3.5)
    time_term = max(0.0, 100.0 - abs(hours_before_detection - 3.0) * 10.0)
    type_score = {
        "tanker": 90.0,
        "cargo": 75.0,
        "passenger": 30.0,
        "fishing": 20.0,
        "tug": 45.0,
        "unknown": 40.0,
    }.get(vessel.vessel_type, 40.0)

    gap_bonus = 20.0 if vessel.suspicious_gap else 0.0
    anomaly_bonus = 20.0 if vessel.speed_anomaly else 0.0
    dock_penalty = 50.0 if vessel.legitimately_docked else 0.0
    culprit_bonus = 20.0 if culprit else 0.0

    score = (prox * 0.38) + (time_term * 0.22) + (type_score * 0.18) + gap_bonus + anomaly_bonus + culprit_bonus - dock_penalty
    return max(0.0, min(100.0, score))


def build_case(case_id: str, name: str, origin_lat: float, origin_lon: float, area_km2: float, behavior: str) -> Case:
    base_dt = datetime(2024, 6, 1, 12, 0, tzinfo=timezone.utc)
    culprit = Vessel(
        mmsi="111111111",
        name="Culprit Vessel",
        lat=origin_lat + 0.02,
        lon=origin_lon + 0.03,
        vessel_type="tanker",
        speed_kn=12.5,
        suspicious_gap=True,
        speed_anomaly=True,
        legitimately_docked=False,
    )

    neighbors = [
        Vessel("222222222", "Decoy Cargo", origin_lat + 0.15, origin_lon + 0.18, "cargo", 12.7),
        Vessel("333333333", "Decoy Tanker", origin_lat - 0.18, origin_lon + 0.12, "tanker", 9.8),
        Vessel("444444444", "Local Fishing", origin_lat + 0.04, origin_lon - 0.22, "fishing", 7.1),
        Vessel("555555555", "Harbour Tug", origin_lat + 0.26, origin_lon + 0.06, "tug", 6.9, legitimately_docked=True),
        Vessel("666666666", "Fast Cargo", origin_lat - 0.3, origin_lon - 0.16, "cargo", 16.2),
    ]

    if behavior == "clean_hit":
        return Case(case_id, name, base_dt.isoformat(), culprit.mmsi, culprit.name, origin_lat, origin_lon, area_km2, [culprit] + neighbors)

    if behavior == "decoy_nearby":
        neighbors[0] = Vessel("222222222", "Decoy Cargo", origin_lat + 0.04, origin_lon + 0.05, "cargo", 11.0, suspicious_gap=True, speed_anomaly=True)
        return Case(case_id, name, base_dt.isoformat(), culprit.mmsi, culprit.name, origin_lat, origin_lon, area_km2, [culprit] + neighbors)

    if behavior == "port_decoy":
        neighbors[3] = Vessel("555555555", "Harbour Tug", origin_lat + 0.01, origin_lon + 0.02, "tug", 5.2, suspicious_gap=False, speed_anomaly=False, legitimately_docked=True)
        return Case(case_id, name, base_dt.isoformat(), culprit.mmsi, culprit.name, origin_lat, origin_lon, area_km2, [culprit] + neighbors)

    if behavior == "missing_ais":
        return Case(case_id, name, base_dt.isoformat(), culprit.mmsi, culprit.name, origin_lat, origin_lon, area_km2, [Vessel("777777777", "Only vessel", origin_lat + 1.0, origin_lon + 1.0, "cargo", 10.0)])

    if behavior == "dark_vessel":
        culprit.suspicious_gap = True
        culprit.speed_anomaly = False
        neighbors[1] = Vessel("333333333", "Decoy Tanker", origin_lat + 0.02, origin_lon + 0.02, "tanker", 12.0, suspicious_gap=True, speed_anomaly=True)
        return Case(case_id, name, base_dt.isoformat(), culprit.mmsi, culprit.name, origin_lat, origin_lon, area_km2, [culprit] + neighbors)

    if behavior == "origin_shift":
        return Case(case_id, name, base_dt.isoformat(), culprit.mmsi, culprit.name, origin_lat + 0.35, origin_lon + 0.4, area_km2, [culprit] + neighbors)

    if behavior == "low_coverage":
        neighbors = [
            Vessel("333333333", "Distant Cargo", origin_lat + 0.8, origin_lon + 0.9, "cargo", 11.0),
            Vessel("444444444", "Distant Fishing", origin_lat - 0.85, origin_lon + 0.7, "fishing", 6.5),
        ]
        return Case(case_id, name, base_dt.isoformat(), culprit.mmsi, culprit.name, origin_lat, origin_lon, area_km2, [culprit] + neighbors)

    return Case(case_id, name, base_dt.isoformat(), culprit.mmsi, culprit.name, origin_lat, origin_lon, area_km2, [culprit] + neighbors)


def rank_case(case: Case) -> list[str]:
    scores: list[tuple[str, float]] = []
    for vessel in case.vessels:
        distance_km = haversine_km(case.actual_origin_lat, case.actual_origin_lon, vessel.lat, vessel.lon)
        hours_before = 3.0 + (math.sin(abs(vessel.lon - case.actual_origin_lon)) * 2.0)
        culprit = vessel.mmsi == case.actual_culprit_mmsi
        score = vessel_score(distance_km, hours_before, vessel, culprit)
        scores.append((vessel.mmsi, score))

    scores.sort(key=lambda x: x[1], reverse=True)
    return [mmsi for mmsi, _ in scores]


def evaluate_rank(case: Case, ranked: list[str]) -> dict:
    actual = case.actual_culprit_mmsi
    if actual not in ranked:
        return {"rank": None, "hit_1": False, "hit_3": False, "hit_5": False, "miss": True}
    rank = ranked.index(actual) + 1
    return {
        "rank": rank,
        "hit_1": rank == 1,
        "hit_3": rank <= 3,
        "hit_5": rank <= 5,
        "miss": False,
    }


def build_cases() -> list[Case]:
    behaviors = [
        "clean_hit",
        "decoy_nearby",
        "port_decoy",
        "missing_ais",
        "dark_vessel",
        "origin_shift",
        "low_coverage",
        "clean_hit",
        "decoy_nearby",
        "dark_vessel",
    ]

    origins = [
        (19.55, 71.31),
        (11.20, -60.75),
        (18.1, 70.3),
        (-20.37, 57.73),
        (20.0, 64.0),
        (12.2, 61.0),
        (15.2, 67.1),
        (17.8, 68.7),
        (13.1, -61.1),
        (21.4, 69.5),
    ]

    cases = []
    for idx, ((lat, lon), behavior) in enumerate(zip(origins, behaviors), start=1):
        case = build_case(f"case_{idx:02d}", f"Synthetic case {idx}", lat, lon, 15.0 + idx, behavior)
        cases.append(case)
    return cases


def run_benchmark() -> dict:
    cases = build_cases()
    rows = []
    total = len(cases)
    for case in cases:
        ranked = rank_case(case)
        result = evaluate_rank(case, ranked)
        rows.append({
            "incident_id": case.incident_id,
            "incident_name": case.incident_name,
            "actual_culprit_mmsi": case.actual_culprit_mmsi,
            "rank": result["rank"],
            "hit_1": result["hit_1"],
            "hit_3": result["hit_3"],
            "hit_5": result["hit_5"],
            "miss": result["miss"],
            "ranked_mmsis": ranked,
        })

    hit_1 = sum(1 for r in rows if r["hit_1"]) / total
    hit_3 = sum(1 for r in rows if r["hit_3"]) / total
    hit_5 = sum(1 for r in rows if r["hit_5"]) / total
    miss_rate = sum(1 for r in rows if r["miss"]) / total
    ranks = [r["rank"] for r in rows if r["rank"] is not None]
    avg_rank = sum(ranks) / len(ranks) if ranks else None

    return {
        "total_cases": total,
        "hit_1": hit_1,
        "hit_3": hit_3,
        "hit_5": hit_5,
        "miss_rate": miss_rate,
        "average_rank": avg_rank,
        "rows": rows,
    }


def print_summary(summary: dict) -> None:
    print("Synthetic suspect benchmark (robustness-focused)")
    print("=" * 50)
    print(f"Total cases: {summary['total_cases']}")
    print(f"Hit@1: {summary['hit_1'] * 100:.1f}%")
    print(f"Hit@3: {summary['hit_3'] * 100:.1f}%")
    print(f"Hit@5: {summary['hit_5'] * 100:.1f}%")
    print(f"Miss rate: {summary['miss_rate'] * 100:.1f}%")
    print(f"Average rank of true culprit: {summary['average_rank']}")
    print()
    for row in summary["rows"]:
        print(
            f"{row['incident_id']} | {row['incident_name']} | rank={row['rank']} | "
            f"hit1={row['hit_1']} hit3={row['hit_3']} hit5={row['hit_5']} miss={row['miss']} | "
            f"candidates={row['ranked_mmsis']}"
        )


if __name__ == "__main__":
    summary = run_benchmark()
    print_summary(summary)

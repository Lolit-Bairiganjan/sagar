import os
from dotenv import load_dotenv

load_dotenv()  # reads the .env file and loads its values into the environment

DATABASE_URL = os.getenv("DATABASE_URL")

if DATABASE_URL is None:
    raise RuntimeError(
        "DATABASE_URL is not set. Did you create a .env file with your Supabase connection string?"
    )


# ============================================================================
# Domain configuration — thresholds, weights, and heuristics for the
# oil spill / AIS correlation engine. Every value here is annotated with
# WHY it was chosen (SIH26143 spec §22: no hardcoded assumptions).
# ============================================================================

# ── §1: Dynamic Search Zone & Time Windowing ────────────────────────────

INVESTIGATION_WINDOW_HOURS = 6

SPILL_AREA_BUFFER_TIERS_KM = [
    (1, 5),
    (10, 10),
    (float("inf"), 25),
]

GAP_ZONE_BUFFER_METERS = 25000  # matches the >10 km² spill area tier


# ── §2: AIS Preprocessing ────────────────────────────────────────────────

MAX_PLAUSIBLE_SPEED_KMH = 100


# ── §6: Trajectory Reconstruction (segmentation) ────────────────────────

# Calibrated against ~1.09M real AIS pings (Kaggle/NOAA-sourced): only
# 0.131% of real inter-ping gaps exceed 2 hours, only 0.357% exceed 1 hour.
SEGMENT_GAP_HOURS = 2
MIN_POINTS_FOR_TRAJECTORY = 2


# ── §11: Dark Target / AIS Gap Detection ────────────────────────────────

AIS_GAP_FLAG_HOURS = 1


# ── §12: Speed Anomaly Detection ────────────────────────────────────────
# Calibrated against ~400K real AIS speed transitions (Kaggle/NOAA-sourced).
# Among vessels already underway (>=5 km/h) with a meaningful absolute
# change (>=3 km/h), a full speed doubling/halving (ratio >= 1.0) sits at
# the ~90th percentile of real behavior -- a statistically rare event,
# not normal cruising variation. Excludes near-zero starting speeds
# (e.g. leaving port) which would otherwise dominate the signal with
# mundane, non-suspicious speed changes.
MIN_UNDERWAY_SPEED_KMH = 5
MIN_ABSOLUTE_SPEED_CHANGE_KMH = 3
SPEED_ANOMALY_RATIO_THRESHOLD = 1.0


# ── §9: Ship Type Weighting ──────────────────────────────────────────────

SHIP_TYPE_WEIGHTS = {
    "tanker": 100,
    "cargo": 80,
    "unknown": 40,
    "other": 20,
}

TANKER_TYPE_RANGE = (80, 89)
CARGO_TYPE_RANGE = (70, 79)
PASSENGER_TYPE_RANGE = (60, 69)


# ── §14: Final Suspect Scoring (weights) ────────────────────────────────

SCORING_WEIGHTS = {
    "proximity": 0.35,
    "trajectory_alignment": 0.15,
    "speed_anomaly": 0.15,
    "vessel_type": 0.15,
    "ais_gap": 0.20,
}
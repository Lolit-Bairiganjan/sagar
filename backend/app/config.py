import os
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")
if DATABASE_URL is None:
    raise RuntimeError("DATABASE_URL is not set.")

SPILL_AREA_BUFFER_TIERS_KM = [(1, 5), (10, 10), (float("inf"), 25)]

MAX_PLAUSIBLE_SPEED_KMH = 100
SEGMENT_GAP_HOURS = 2
MIN_POINTS_FOR_TRAJECTORY = 2
AIS_GAP_FLAG_HOURS = 1

MIN_UNDERWAY_SPEED_KMH = 5
MIN_ABSOLUTE_SPEED_CHANGE_KMH = 3
SPEED_ANOMALY_RATIO_THRESHOLD = 1.0

SHIP_TYPE_WEIGHTS = {"tanker": 100, "cargo": 80, "passenger": 20, "unknown": 40, "other": 20}
TANKER_TYPE_RANGE = (80, 89)
CARGO_TYPE_RANGE = (70, 79)
PASSENGER_TYPE_RANGE = (60, 69)

PORT_STATIONARY_SPEED_KMH = 0.93  # 0.5 knots converted to km/h
PORT_DOCKED_SCORE_MULTIPLIER = 0.3

WIND_DRIFT_FACTOR = 0.03
FALLBACK_CURRENT_SPEED_MS = 0.3
DEFAULT_DRIFT_HOURS = 3.0

# Weights sum to 0.85, NOT 1.0 -- trajectory_alignment is not yet built.
# The scoring query divides by 0.85 (sum of ACTIVE dimensions), not 1.0.
SCORING_WEIGHTS = {
    "proximity": 0.35,
    "trajectory_alignment": 0.15,
    "speed_anomaly": 0.15,
    "vessel_type": 0.15,
    "ais_gap": 0.20,
}
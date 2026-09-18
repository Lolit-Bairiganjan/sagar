import unittest
from datetime import datetime, timezone

from app.queries.suspects import resolve_suspect_search_parameters
from app.services.drift import (
    estimate_drift_horizon_hours,
    estimate_discharge_time,
    estimate_origin_point,
    estimate_spill_radius_km,
)


class TestDriftModel(unittest.TestCase):
    def test_small_spill_has_shorter_horizon(self):
        self.assertLess(estimate_drift_horizon_hours(0.5), 12.0)
        self.assertGreaterEqual(estimate_drift_horizon_hours(0.5), 3.0)

    def test_large_spill_has_longer_horizon(self):
        self.assertGreater(estimate_drift_horizon_hours(50.0), 12.0)

    def test_radius_scales_with_area(self):
        radius_small = estimate_spill_radius_km(1.0)
        radius_large = estimate_spill_radius_km(25.0)
        self.assertGreater(radius_large, radius_small)

    def test_discharge_time_is_before_detection_time(self):
        detected_at = datetime(2026, 9, 18, 12, 0, tzinfo=timezone.utc)
        discharge_at = estimate_discharge_time(detected_at, 6.0)
        self.assertLess(discharge_at, detected_at)

    def test_origin_point_moves_backwards_from_drift_direction(self):
        lat, lon = estimate_origin_point(15.0, 80.0, 6.0, 90.0)
        self.assertAlmostEqual(lat, 15.0, places=3)
        self.assertLess(lon, 80.0)

    def test_suspect_window_prefers_estimated_discharge_time(self):
        detected_at = datetime(2026, 9, 18, 12, 0, tzinfo=timezone.utc)
        estimated_discharge = datetime(2026, 9, 18, 6, 0, tzinfo=timezone.utc)
        params = resolve_suspect_search_parameters(
            detected_at=detected_at,
            drift_hours_assumed=18.0,
            estimated_discharge_at=estimated_discharge,
            origin_lat=12.5,
            origin_lon=77.2,
        )
        self.assertEqual(params["t_start"], estimated_discharge)
        self.assertEqual(params["origin_lat"], 12.5)
        self.assertEqual(params["origin_lon"], 77.2)


if __name__ == "__main__":
    unittest.main()

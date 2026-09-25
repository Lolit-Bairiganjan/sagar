import unittest

from app import config
from app.services.drift import estimate_drift_horizon_hours


class TestDriftDefaults(unittest.TestCase):
    def test_default_drift_window_matches_api_contract(self):
        self.assertEqual(config.DEFAULT_DRIFT_HOURS, 6.0)

    def test_horizon_scales_continuously_with_area(self):
        small = estimate_drift_horizon_hours(0.5)
        medium = estimate_drift_horizon_hours(25.0)
        large = estimate_drift_horizon_hours(250.0)

        self.assertEqual(small, 6.0)
        self.assertGreater(medium, small)
        self.assertGreater(large, medium)
        self.assertLess(medium, 18.0)
        self.assertLessEqual(large, 24.0)


if __name__ == "__main__":
    unittest.main()

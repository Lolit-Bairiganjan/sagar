import unittest

from app import config


class TestDriftDefaults(unittest.TestCase):
    def test_default_drift_window_matches_api_contract(self):
        self.assertEqual(config.DEFAULT_DRIFT_HOURS, 6.0)


if __name__ == "__main__":
    unittest.main()

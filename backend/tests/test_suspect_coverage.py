import unittest

from app.queries.suspects import evaluate_ais_coverage


class TestSuspectCoverage(unittest.TestCase):
    def test_missing_ais_coverage_is_detected(self):
        result = evaluate_ais_coverage(0, 0)
        self.assertFalse(result["coverage_ok"])
        self.assertIn("No AIS coverage", result["message"])

    def test_valid_coverage_is_allowed(self):
        result = evaluate_ais_coverage(12, 3)
        self.assertTrue(result["coverage_ok"])
        self.assertEqual(result["candidate_rows"], 12)
        self.assertEqual(result["distinct_mmsi"], 3)


if __name__ == "__main__":
    unittest.main()

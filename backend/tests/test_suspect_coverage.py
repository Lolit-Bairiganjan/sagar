import unittest

from app.queries.suspects import (
    QUERY_TEXT,
    evaluate_ais_coverage,
    origin_corridor_radius_m,
)


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

    def test_origin_corridor_uses_area_tiers(self):
        self.assertEqual(origin_corridor_radius_m(0.5), 5000)
        self.assertEqual(origin_corridor_radius_m(1), 10000)
        self.assertEqual(origin_corridor_radius_m(10), 10000)
        self.assertEqual(origin_corridor_radius_m(10.1), 25000)

    def test_suspect_query_uses_origin_window_and_optional_heading_evidence(self):
        self.assertIn("ap.ts BETWEEN b.t_start AND b.t_end", QUERY_TEXT)
        self.assertIn("b.estimated_discharge_point::geography", QUERY_TEXT)
        self.assertIn("heading_alignment_score", QUERY_TEXT)
        self.assertIn("CASE WHEN bp.heading_alignment_score IS NULL THEN 0.85 ELSE 1.0 END", QUERY_TEXT)


if __name__ == "__main__":
    unittest.main()

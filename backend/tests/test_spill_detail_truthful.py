import unittest
from datetime import datetime, timezone
from unittest.mock import patch

from app.routes.spills import spill_detail


class TestSpillDetailTruthfulDefaults(unittest.TestCase):
    @patch("app.routes.spills.get_suspects", return_value=[])
    @patch("app.routes.spills.get_spill_by_id")
    def test_missing_reconstruction_and_ais_data_are_not_filled_with_estimates(
        self, get_spill_by_id, get_suspects
    ):
        get_spill_by_id.return_value = {
            "id": 12,
            "detected_at": datetime(2026, 10, 17, 12, 0, tzinfo=timezone.utc),
            "area_km2": 1.25,
            "centroid_lat": 18.5,
            "centroid_lon": 71.5,
            "polygon_geojson": {
                "type": "Polygon",
                "coordinates": [[[71.4, 18.4], [71.6, 18.4], [71.4, 18.4]]],
            },
            "estimated_origin_geojson": None,
            "origin_lat": None,
            "origin_lon": None,
            "estimated_discharge_at": None,
            "drift_hours_assumed": None,
        }

        result = spill_detail(12)

        self.assertIsNone(result["spill"]["detectionConfidencePct"])
        self.assertIsNone(result["spill"]["estimatedAgeHours"])
        self.assertIsNone(result["spill"]["origin"]["location"])
        self.assertEqual(result["spill"]["drift"]["forecast"], [])
        self.assertEqual([frame["label"] for frame in result["spill"]["drift"]["backtrack"]], ["NOW"])
        self.assertIsNone(result["ocean"]["windSpeedKn"])
        self.assertIsNone(result["ocean"]["currentSpeedKn"])
        self.assertIsNone(result["ocean"]["seaStateM"])
        self.assertIsNone(result["ocean"]["temperatureC"])
        self.assertEqual(result["coverage_status"], "no_candidates")
        get_suspects.assert_called_once_with(12, origin_lat=None, origin_lon=None)


if __name__ == "__main__":
    unittest.main()

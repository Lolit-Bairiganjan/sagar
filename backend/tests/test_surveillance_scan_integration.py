import json
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from app.routes.surveillance import ScanRequest, trigger_scan


class TestSurveillanceScanIntegration(unittest.TestCase):
    def run_scan(self, summary, insert_side_effect, suspects):
        temporary_directory = tempfile.TemporaryDirectory()
        self.addCleanup(temporary_directory.cleanup)
        output_path = Path(temporary_directory.name) / "scan.json"
        output_path.write_text(json.dumps(summary), encoding="utf-8")

        with (
            patch("app.routes.surveillance._OUTPUT_JSON", output_path),
            patch("app.routes.surveillance._PIPELINE_SCRIPT", Path(__file__)),
            patch("app.routes.surveillance.get_ai_python_executable", return_value=Path(sys.executable)),
            patch(
                "app.routes.surveillance.subprocess.run",
                return_value=SimpleNamespace(returncode=0, stderr="", stdout=""),
            ),
            patch("app.queries.spills.insert_spill", side_effect=insert_side_effect),
            patch("app.services.drift.process_new_spill"),
            patch("app.queries.suspects.get_suspects", return_value=suspects) as get_suspects,
        ):
            result = trigger_scan(ScanRequest(zone="mumbai_high"))

        return result, get_suspects

    def test_detection_ids_remain_aligned_when_a_detection_is_not_persisted(self):
        polygon = {"type": "Polygon", "coordinates": [[[71.4, 19.5], [71.5, 19.5], [71.4, 19.5]]]}
        summary = {
            "status": "ANOMALY_DETECTED",
            "timestamp": "2026-10-17T12:00:00Z",
            "spills": [
                {"centroid_lat": 19.5, "centroid_lon": 71.4},
                {"centroid_lat": 19.6, "centroid_lon": 71.5, "spill_polygon_geojson": polygon},
                {"centroid_lat": 19.7, "centroid_lon": 71.6, "spill_polygon_geojson": polygon},
            ],
        }
        candidate = {
            "mmsi": "123456789",
            "name": "Test Vessel",
            "distance_km": 2.0,
            "hours_before_detection": 1.0,
            "proximity_score": 80.0,
            "time_score": 75.0,
            "type_score": 50.0,
            "has_suspicious_gap": False,
            "gap_score": 0.0,
            "has_speed_anomaly": False,
            "speed_anomaly_score": 0.0,
            "final_score": 70.0,
            "flags": [],
        }

        result, get_suspects = self.run_scan(summary, [41, RuntimeError("database unavailable")], [candidate])

        self.assertEqual(result["persisted_spill_ids_by_detection"], [None, 41, None])
        self.assertEqual(
            [item["detection_index"] for item in result["spill_investigations"]],
            [0, 1, 2],
        )
        self.assertEqual(
            [item["ais_status"] for item in result["spill_investigations"]],
            ["spill_not_persisted", "available", "spill_not_persisted"],
        )
        self.assertEqual(result["spill_investigations"][1]["suspects"], [candidate])
        get_suspects.assert_called_once_with(41)

    def test_empty_ais_query_returns_no_candidate_instead_of_demo_vessel(self):
        polygon = {"type": "Polygon", "coordinates": [[[71.4, 19.5], [71.5, 19.5], [71.4, 19.5]]]}
        summary = {
            "status": "ANOMALY_DETECTED",
            "timestamp": "2026-10-17T12:00:00Z",
            "spills": [
                {"centroid_lat": 19.5, "centroid_lon": 71.4, "spill_polygon_geojson": polygon},
            ],
        }

        result, _ = self.run_scan(summary, [41], [])

        self.assertEqual(result["spill_investigations"][0]["ais_status"], "no_candidates")
        self.assertEqual(result["spill_investigations"][0]["suspects"], [])
        self.assertEqual(result["suspects"], [])
        self.assertIsNone(result["max_suspect"])


if __name__ == "__main__":
    unittest.main()

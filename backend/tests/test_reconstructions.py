import json
import unittest
from datetime import datetime, timezone
from unittest.mock import Mock, patch

from app.queries.reconstructions import get_latest_reconstruction
from app.routes import spills as spill_routes
from app.services.drift import ensure_database_compatibility, save_drift_estimate
from fastapi import HTTPException


class TestReconstructionPersistence(unittest.TestCase):
    def setUp(self):
        self.detected_at = datetime(2026, 9, 18, 12, 0, tzinfo=timezone.utc)
        self.reconstruction = {
            "model_version": "stepwise-hourly-v1",
            "detected_at": self.detected_at,
            "start_at": datetime(2026, 9, 18, 11, 0, tzinfo=timezone.utc),
            "drift": {
                "drift_hours_assumed": 1,
                "combined_drift_speed_kmh": 0.5,
                "combined_drift_direction_deg": 270,
                "total_drift_distance_km": 0.5,
            },
            "estimated_origin": {"lat": 15.0, "lng": 80.1},
            "uncertainty": {"status": "not_quantified", "probability_calibrated": False},
            "input_provenance": {
                "provider": "Open-Meteo",
                "temporal_resolution_hours": 1,
                "requested_coordinate": {"lat": 15.0, "lng": 80.0},
            },
            "frames": [
                {
                    "label": "T-1h",
                    "timestampUtc": "2026-09-18T11:00:00+00:00",
                    "hoursBeforeDetection": 1,
                    "location": {"lat": 15.0, "lng": 80.1},
                    "weather": {"windSource": "open-meteo-archive"},
                },
                {
                    "label": "NOW",
                    "timestampUtc": "2026-09-18T12:00:00+00:00",
                    "hoursBeforeDetection": 0,
                    "location": {"lat": 15.0, "lng": 80.0},
                    "isCurrent": True,
                },
            ],
        }

    @patch("app.services.drift.get_connection")
    def test_saves_estimate_run_and_frames_atomically(self, get_connection):
        connection = Mock()
        cursor = Mock()
        cursor.fetchone.return_value = (901,)
        connection.cursor.return_value = cursor
        get_connection.return_value = connection

        save_drift_estimate(
            42,
            {
                "wind_speed_kmh": 10,
                "wind_direction_deg": 90,
                "current_speed_kmh": 0.5,
                "current_direction_deg": 270,
                "current_data_source": "open-meteo-marine",
            },
            self.reconstruction["drift"],
            estimated_discharge_at=self.reconstruction["start_at"],
            origin_lat=15.0,
            origin_lon=80.1,
            reconstruction=self.reconstruction,
        )

        self.assertEqual(cursor.execute.call_count, 2)
        run_params = cursor.execute.call_args_list[1].args[1]
        self.assertEqual(run_params["model_version"], "stepwise-hourly-v1")
        self.assertEqual(json.loads(run_params["uncertainty"])["status"], "not_quantified")
        self.assertEqual(
            json.loads(run_params["input_provenance"])["provider"], "Open-Meteo"
        )
        cursor.executemany.assert_called_once()
        frame_params = cursor.executemany.call_args.args[1]
        self.assertEqual([frame["frame_index"] for frame in frame_params], [0, 1])
        self.assertTrue(all(frame["run_id"] == 901 for frame in frame_params))
        connection.commit.assert_called_once()
        connection.rollback.assert_not_called()
        connection.close.assert_called_once()

    @patch("app.services.drift.get_connection")
    def test_rolls_back_estimate_and_frames_together_when_frame_insert_fails(
        self, get_connection
    ):
        connection = Mock()
        cursor = Mock()
        cursor.fetchone.return_value = (901,)
        cursor.executemany.side_effect = RuntimeError("frame insert failed")
        connection.cursor.return_value = cursor
        get_connection.return_value = connection

        with self.assertRaisesRegex(RuntimeError, "frame insert failed"):
            save_drift_estimate(
                42,
                {
                    "wind_speed_kmh": 10,
                    "wind_direction_deg": 90,
                    "current_speed_kmh": 0.5,
                    "current_direction_deg": 270,
                    "current_data_source": "open-meteo-marine",
                },
                self.reconstruction["drift"],
                reconstruction=self.reconstruction,
            )

        connection.rollback.assert_called_once()
        connection.commit.assert_not_called()
        connection.close.assert_called_once()

    @patch("app.services.drift.get_connection")
    def test_startup_compatibility_creates_reconstruction_tables(self, get_connection):
        connection = Mock()
        cursor = Mock()
        connection.cursor.return_value = cursor
        get_connection.return_value = connection

        ensure_database_compatibility()

        statements = [call.args[0] for call in cursor.execute.call_args_list]
        self.assertTrue(any("CREATE TABLE IF NOT EXISTS reconstruction_runs" in sql for sql in statements))
        self.assertTrue(any("CREATE TABLE IF NOT EXISTS reconstruction_frames" in sql for sql in statements))
        connection.commit.assert_called_once()

    @patch("app.queries.reconstructions.get_connection")
    def test_latest_reconstruction_returns_ordered_frames_and_decodes_json(
        self, get_connection
    ):
        connection = Mock()
        cursor = Mock()
        cursor.description = [
            (column,)
            for column in (
                "id",
                "spill_id",
                "model_version",
                "status",
                "detected_at",
                "horizon_hours",
                "start_at",
                "end_at",
                "summary",
                "uncertainty",
                "input_provenance",
                "created_at",
            )
        ]
        cursor.fetchone.return_value = (
            901,
            42,
            "stepwise-hourly-v1",
            "complete",
            self.detected_at,
            1,
            self.reconstruction["start_at"],
            self.detected_at,
            '{"origin": {"lat": 15.0, "lng": 80.1}}',
            '{"status": "not_quantified"}',
            '{"provider": "Open-Meteo"}',
            self.detected_at,
        )
        cursor.fetchall.return_value = [
            ('{"label": "T-1h"}',),
            ('{"label": "NOW"}',),
        ]
        connection.cursor.return_value = cursor
        get_connection.return_value = connection

        result = get_latest_reconstruction(42)

        self.assertEqual(result["id"], 901)
        self.assertEqual(result["summary"]["origin"]["lat"], 15.0)
        self.assertEqual(result["uncertainty"]["status"], "not_quantified")
        self.assertEqual(result["input_provenance"]["provider"], "Open-Meteo")
        self.assertEqual([frame["label"] for frame in result["frames"]], ["T-1h", "NOW"])
        self.assertEqual(cursor.execute.call_count, 2)
        connection.close.assert_called_once()

    @patch("app.routes.spills.get_latest_reconstruction")
    @patch("app.routes.spills.get_spill_by_id", return_value={"id": 42})
    def test_spill_reconstruction_route_returns_latest_run(
        self, _get_spill_by_id, get_latest
    ):
        run = {"id": 901, "spill_id": 42, "frames": [{"label": "NOW"}]}
        get_latest.return_value = run

        self.assertEqual(spill_routes.spill_reconstruction(42), run)
        get_latest.assert_called_once_with(42)

    @patch("app.routes.spills.get_latest_reconstruction", return_value=None)
    @patch("app.routes.spills.get_spill_by_id", return_value={"id": 42})
    def test_spill_reconstruction_route_reports_missing_run(
        self, _get_spill_by_id, _get_latest
    ):
        with self.assertRaises(HTTPException) as raised:
            spill_routes.spill_reconstruction(42)
        self.assertEqual(raised.exception.status_code, 404)
        self.assertIn("No persisted reconstruction", raised.exception.detail)

    @patch("app.routes.spills.get_spill_by_id", return_value=None)
    def test_spill_reconstruction_route_reports_missing_spill(self, _get_spill_by_id):
        with self.assertRaises(HTTPException) as raised:
            spill_routes.spill_reconstruction(999)
        self.assertEqual(raised.exception.status_code, 404)
        self.assertIn("Spill 999 not found", raised.exception.detail)


if __name__ == "__main__":
    unittest.main()

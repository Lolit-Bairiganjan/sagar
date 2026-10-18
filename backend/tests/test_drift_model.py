import unittest
from datetime import datetime, timezone
from unittest.mock import Mock, patch

from app.routes import spills as spill_routes
from app.services.drift import DriftDataError, integrate_reverse_drift
from app.queries.suspects import resolve_suspect_search_parameters
from app.services.drift import (
    estimate_drift_horizon_hours,
    estimate_discharge_time,
    estimate_origin_point,
    estimate_spill_radius_km,
    fetch_hourly_drift_conditions,
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
        self.assertEqual(
            params["origin_time"],
            estimated_discharge,
        )
        self.assertEqual(params["t_start"], datetime(2026, 9, 18, 5, 0, tzinfo=timezone.utc))
        self.assertEqual(params["t_end"], datetime(2026, 9, 18, 7, 0, tzinfo=timezone.utc))
        self.assertEqual(params["origin_lat"], 12.5)
        self.assertEqual(params["origin_lon"], 77.2)

    def test_suspect_window_clamps_end_to_detection_time(self):
        detected_at = datetime(2026, 9, 18, 12, 0, tzinfo=timezone.utc)
        params = resolve_suspect_search_parameters(
            detected_at=detected_at,
            estimated_discharge_at=datetime(2026, 9, 18, 11, 30, tzinfo=timezone.utc),
        )

        self.assertEqual(params["t_start"], datetime(2026, 9, 18, 10, 30, tzinfo=timezone.utc))
        self.assertEqual(params["t_end"], detected_at)

    def test_stepwise_integration_uses_each_hourly_current(self):
        detected_at = datetime(2026, 9, 18, 12, 0, tzinfo=timezone.utc)
        samples = {
            datetime(2026, 9, 18, 12, 0, tzinfo=timezone.utc): {
                "wind_speed_kmh": 0,
                "wind_direction_deg": 0,
                "current_speed_kmh": 1,
                "current_direction_deg": 90,
                "current_data_source": "open-meteo-marine",
            },
            datetime(2026, 9, 18, 11, 0, tzinfo=timezone.utc): {
                "wind_speed_kmh": 0,
                "wind_direction_deg": 0,
                "current_speed_kmh": 1,
                "current_direction_deg": 0,
                "current_data_source": "open-meteo-marine",
            },
        }

        result = integrate_reverse_drift(0, 0, detected_at, 2, samples)

        self.assertEqual(len(result["frames"]), 3)
        self.assertLess(result["estimated_origin"]["lat"], 0)
        self.assertLess(result["estimated_origin"]["lng"], 0)
        self.assertEqual(result["frames"][-1]["label"], "NOW")
        self.assertIn("weather", result["frames"][0])

    def test_synthetic_constant_current_recovers_known_origin(self):
        detected_at = datetime(2026, 9, 18, 12, 0, tzinfo=timezone.utc)
        sample = {
            "wind_speed_kmh": 0,
            "wind_direction_deg": 0,
            "current_speed_kmh": 1,
            "current_direction_deg": 90,
            "current_data_source": "synthetic",
        }
        samples = {
            datetime(2026, 9, 18, 12, 0, tzinfo=timezone.utc): sample,
            datetime(2026, 9, 18, 11, 0, tzinfo=timezone.utc): sample,
        }

        result = integrate_reverse_drift(0, 0, detected_at, 2, samples)

        self.assertAlmostEqual(result["estimated_origin"]["lat"], 0, places=6)
        self.assertAlmostEqual(result["estimated_origin"]["lng"], -2 / 111, places=6)
        self.assertEqual(
            [frame["hoursBeforeDetection"] for frame in result["frames"]],
            [2, 1, 0.0],
        )
        self.assertEqual(
            [frame["timestampUtc"] for frame in result["frames"]],
            [
                "2026-09-18T10:00:00+00:00",
                "2026-09-18T11:00:00+00:00",
                "2026-09-18T12:00:00+00:00",
            ],
        )

    def test_stepwise_result_reports_unquantified_uncertainty_and_unmodeled_oil_scenarios(self):
        detected_at = datetime(2026, 9, 18, 12, 0, tzinfo=timezone.utc)
        samples = {
            datetime(2026, 9, 18, 12, 0, tzinfo=timezone.utc): {
                "wind_speed_kmh": 10,
                "wind_direction_deg": 90,
                "current_speed_kmh": 0.5,
                "current_direction_deg": 270,
                "current_data_source": "open-meteo-marine",
            }
        }

        result = integrate_reverse_drift(0, 0, detected_at, 1, samples)

        self.assertEqual(result["model_version"], "stepwise-hourly-v1")
        self.assertEqual(result["uncertainty"]["status"], "not_quantified")
        self.assertFalse(result["uncertainty"]["probability_calibrated"])
        self.assertIsNone(result["uncertainty"]["position_bounds_km"])
        self.assertEqual(
            result["uncertainty"]["coastline_interaction"],
            {
                "status": "not_modeled",
                "path_may_cross_land": True,
                "positions_are_clipped_to_coastline": False,
            },
        )
        self.assertEqual(result["uncertainty"]["slick_evolution"]["status"], "not_modeled")
        self.assertIsNone(result["uncertainty"]["slick_evolution"]["area_by_frame"])
        self.assertEqual(result["uncertainty"]["data_quality"]["status"], "complete")
        self.assertEqual(result["uncertainty"]["oil_scenarios"]["status"], "not_modeled")
        self.assertIn("Coastline and land-boundary interactions are not modeled.",
                      result["uncertainty"]["limitations"])

    def test_wind_from_direction_is_reversed_for_oil_motion(self):
        detected_at = datetime(2026, 9, 18, 12, 0, tzinfo=timezone.utc)
        samples = {
            datetime(2026, 9, 18, 12, 0, tzinfo=timezone.utc): {
                "wind_speed_kmh": 10,
                "wind_direction_deg": 90,
                "current_speed_kmh": 0,
                "current_direction_deg": 0,
                "current_data_source": "open-meteo-marine",
            }
        }

        result = integrate_reverse_drift(0, 0, detected_at, 1, samples)

        self.assertGreater(result["estimated_origin"]["lng"], 0)

    def test_missing_required_hourly_data_fails_explicitly(self):
        detected_at = datetime(2026, 9, 18, 12, 0, tzinfo=timezone.utc)
        sample_time = datetime(2026, 9, 18, 12, 0, tzinfo=timezone.utc)
        samples = {
            sample_time: {
                "wind_speed_kmh": 10,
                "wind_direction_deg": 90,
                "current_speed_kmh": None,
                "current_direction_deg": None,
            }
        }

        with self.assertRaisesRegex(DriftDataError, "current_speed_kmh"):
            integrate_reverse_drift(0, 0, detected_at, 1, samples)

    def test_missing_hourly_timestamp_fails_explicitly(self):
        detected_at = datetime(2026, 9, 18, 12, 0, tzinfo=timezone.utc)

        with self.assertRaisesRegex(DriftDataError, "No hourly wind/current record"):
            integrate_reverse_drift(0, 0, detected_at, 1, {})

    def test_drift_horizon_cannot_exceed_24_hours(self):
        with self.assertRaisesRegex(ValueError, "no more than 24"):
            integrate_reverse_drift(0, 0, datetime.now(timezone.utc), 24.1, {})

    @patch("app.services.drift.requests.get")
    def test_fetch_hourly_conditions_merges_archive_and_marine_sources(self, get):
        wind_response = Mock()
        wind_response.json.return_value = {
            "latitude": 22.53,
            "longitude": 68.52,
            "hourly": {
                "time": ["2024-02-07T12:00"],
                "wind_speed_10m": [10.0],
                "wind_direction_10m": [90.0],
            },
        }
        marine_response = Mock()
        marine_response.json.return_value = {
            "latitude": 22.54,
            "longitude": 68.46,
            "hourly": {
                "time": ["2024-02-07T12:00"],
                "ocean_current_velocity": [0.5],
                "ocean_current_direction": [270.0],
            },
        }
        get.side_effect = [wind_response, marine_response]
        timestamp = datetime(2024, 2, 7, 12, tzinfo=timezone.utc)

        result = fetch_hourly_drift_conditions(22.5, 68.5, timestamp, timestamp)

        self.assertEqual(result[timestamp]["wind_speed_kmh"], 10.0)
        self.assertEqual(result[timestamp]["current_speed_kmh"], 0.5)
        self.assertEqual(result[timestamp]["wind_data_source"], "open-meteo-archive")
        self.assertEqual(result[timestamp]["current_data_source"], "open-meteo-marine")
        self.assertEqual(result[timestamp]["wind_grid_latitude"], 22.53)
        self.assertEqual(result[timestamp]["current_grid_longitude"], 68.46)
        self.assertIn("/v1/archive", get.call_args_list[0].args[0])

    @patch("app.routes.spills.get_suspects", return_value=[])
    @patch("app.routes.spills.get_spill_by_id")
    def test_spill_detail_does_not_claim_unvalidated_origin_confidence(
        self, get_spill_by_id, _get_suspects
    ):
        get_spill_by_id.return_value = {
            "detected_at": datetime(2026, 9, 18, 12, 0, tzinfo=timezone.utc),
            "polygon_geojson": None,
            "centroid_lat": 15.0,
            "centroid_lon": 80.0,
            "drift_hours_assumed": 6.0,
            "origin_lat": 14.9,
            "origin_lon": 80.1,
            "wind_speed_kmh": 12.0,
            "wind_direction_deg": 90.0,
            "current_speed_kmh": 0.5,
            "current_direction_deg": 180.0,
            "combined_drift_speed_kmh": 1.0,
            "combined_drift_direction_deg": 90.0,
        }

        result = spill_routes.spill_detail(1)

        self.assertIsNone(result["spill"]["origin"]["confidencePct"])
        self.assertFalse(result["spill"]["origin"]["uncertainty"]["probabilityCalibrated"])
        self.assertIsNone(result["spill"]["origin"]["uncertainty"]["positionBoundsKm"])


if __name__ == "__main__":
    unittest.main()

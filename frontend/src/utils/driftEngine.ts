/**
 * driftEngine.ts — Client-Side Reverse-Drift & Forward-Trajectory Modeling.
 *
 * Implements the validated maritime Leeway oil spill drift physics:
 * - Wind leeway factor: Oil slicks drift at ~3.0% of wind velocity (windage).
 * - Ocean current: Transports floating oil directly at ~100% of surface current velocity.
 * - Vector composition calculates both the reverse-drift origin (backtrack)
 *   and forward trajectory forecast (forward-projection).
 */

import type { LatLng, DriftTrajectoryNode, OceanographicData } from '../types';

export interface ReverseDriftParams {
  centroid: LatLng;
  observedAtUtc: string;
  windSpeedKmh: number;
  windDirectionDeg: number;
  currentSpeedKmh: number;
  currentDirectionDeg: number;
  driftHours?: number;
}

export interface ReverseDriftResult {
  origin: LatLng;
  combinedDriftSpeedKmh: number;
  combinedDriftDirectionDeg: number;
  totalDriftDistanceKm: number;
  driftHours: number;
  backtrack: DriftTrajectoryNode[];
  forecast: DriftTrajectoryNode[];
  ocean: OceanographicData;
}

const WIND_LEEWAY_FACTOR = 0.03; // Standard 3% wind leeway for heavy & crude marine oil
const KM_PER_DEG_LAT = 111.0;

export function calculateReverseDrift({
  centroid,
  observedAtUtc,
  windSpeedKmh,
  windDirectionDeg,
  currentSpeedKmh,
  currentDirectionDeg,
  driftHours = 6,
}: ReverseDriftParams): ReverseDriftResult {
  // 1. Wind leeway drift vector
  const windDriftSpeed = windSpeedKmh * WIND_LEEWAY_FACTOR;
  const windRad = (windDirectionDeg * Math.PI) / 180;
  const currentRad = (currentDirectionDeg * Math.PI) / 180;

  const windEast = windDriftSpeed * Math.sin(windRad);
  const windNorth = windDriftSpeed * Math.cos(windRad);

  // 2. Surface ocean current vector (100% contribution)
  const currentEast = currentSpeedKmh * Math.sin(currentRad);
  const currentNorth = currentSpeedKmh * Math.cos(currentRad);

  // 3. Combined net drift vector
  const totalEast = windEast + currentEast;
  const totalNorth = windNorth + currentNorth;

  const combinedSpeedKmh = Math.sqrt(totalEast * totalEast + totalNorth * totalNorth);
  let combinedDirectionDeg = (Math.atan2(totalEast, totalNorth) * 180) / Math.PI;
  if (combinedDirectionDeg < 0) combinedDirectionDeg += 360;

  const totalDriftDistanceKm = combinedSpeedKmh * driftHours;

  // 4. Reverse vector to locate the discharge origin point (upstream: +180 deg)
  const reverseRad = ((combinedDirectionDeg + 180) % 360) * (Math.PI / 180);
  const cosLat = Math.max(Math.cos((centroid.lat * Math.PI) / 180), 0.01);
  const kmPerDegLon = KM_PER_DEG_LAT * cosLat;

  const dLatOrigin = (totalDriftDistanceKm * Math.cos(reverseRad)) / KM_PER_DEG_LAT;
  const dLonOrigin = (totalDriftDistanceKm * Math.sin(reverseRad)) / kmPerDegLon;

  const origin: LatLng = {
    lat: Number((centroid.lat + dLatOrigin).toFixed(4)),
    lng: Number((centroid.lng + dLonOrigin).toFixed(4)),
  };

  // Parse detection time to generate timestamped trajectory nodes
  const detTime = new Date(observedAtUtc).getTime();
  const validDetTime = !isNaN(detTime) ? detTime : Date.now();

  // 5. Backtrack trajectory nodes (from Origin at T-6h to Current Slick at NOW)
  const backtrack: DriftTrajectoryNode[] = [
    {
      label: `T-${driftHours}h`,
      location: origin,
      timestampUtc: new Date(validDetTime - driftHours * 3600 * 1000).toISOString(),
    },
    {
      label: `T-${Math.round(driftHours / 2)}h`,
      location: {
        lat: Number((centroid.lat + dLatOrigin * 0.5).toFixed(4)),
        lng: Number((centroid.lng + dLonOrigin * 0.5).toFixed(4)),
      },
      timestampUtc: new Date(validDetTime - (driftHours / 2) * 3600 * 1000).toISOString(),
    },
    {
      label: 'NOW',
      location: centroid,
      timestampUtc: new Date(validDetTime).toISOString(),
      isCurrent: true,
    },
  ];

  // 6. Forward forecast trajectory nodes (projecting downstream +2h and +4h)
  const forwardRad = (combinedDirectionDeg * Math.PI) / 180;
  const dLatFwd4 = (combinedSpeedKmh * 4.0 * Math.cos(forwardRad)) / KM_PER_DEG_LAT;
  const dLonFwd4 = (combinedSpeedKmh * 4.0 * Math.sin(forwardRad)) / kmPerDegLon;

  const forecast: DriftTrajectoryNode[] = [
    {
      label: 'NOW',
      location: centroid,
      timestampUtc: new Date(validDetTime).toISOString(),
      isCurrent: true,
    },
    {
      label: 'T+2h',
      location: {
        lat: Number((centroid.lat + dLatFwd4 * 0.5).toFixed(4)),
        lng: Number((centroid.lng + dLonFwd4 * 0.5).toFixed(4)),
      },
      timestampUtc: new Date(validDetTime + 2 * 3600 * 1000).toISOString(),
    },
    {
      label: 'T+4h',
      location: {
        lat: Number((centroid.lat + dLatFwd4).toFixed(4)),
        lng: Number((centroid.lng + dLonFwd4).toFixed(4)),
      },
      timestampUtc: new Date(validDetTime + 4 * 3600 * 1000).toISOString(),
    },
  ];

  const ocean: OceanographicData = {
    windDirectionDeg: Math.round(windDirectionDeg),
    windSpeedKn: Number((windSpeedKmh * 0.539957).toFixed(1)),
    currentDirectionDeg: Math.round(currentDirectionDeg),
    currentSpeedKn: Number((currentSpeedKmh * 0.539957).toFixed(1)),
    seaStateM: Number((combinedSpeedKmh * 0.08).toFixed(1)),
    temperatureC: 25.0,
  };

  return {
    origin,
    combinedDriftSpeedKmh: Number(combinedSpeedKmh.toFixed(2)),
    combinedDriftDirectionDeg: Math.round(combinedDirectionDeg),
    totalDriftDistanceKm: Number(totalDriftDistanceKm.toFixed(2)),
    driftHours,
    backtrack,
    forecast,
    ocean,
  };
}


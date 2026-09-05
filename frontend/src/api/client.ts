import axios from 'axios';
import type {
  Spill,
  Vessel,
  VesselTrack,
  SatelliteObservation,
  OceanographicData,
  Investigation,
  SystemStatus,
  LatLng,
} from '../types';

// ---------------------------------------------------------------------------
// Backend wiring
// ---------------------------------------------------------------------------
// The whole app talks to these functions only. Right now they resolve mock
// data locally. Once the FastAPI backend exists, point VITE_API_BASE_URL at
// it and flip USE_MOCK to false (or set VITE_USE_MOCK=false) — no component
// needs to change.

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';
const USE_MOCK = (import.meta.env.VITE_USE_MOCK ?? 'true') !== 'false';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 8000,
});

/** Simulates realistic network latency for mock responses. */
function withLatency<T>(data: T, ms = 420): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), ms));
}

// ---------------------------------------------------------------------------
// Mock geography — Arabian Sea, Sector 07
// ---------------------------------------------------------------------------

const SPILL_CENTROID: LatLng = { lat: 20.41, lng: 65.82 };

const SPILL_RING: LatLng[] = [
  { lat: 20.452, lng: 65.771 },
  { lat: 20.468, lng: 65.809 },
  { lat: 20.459, lng: 65.851 },
  { lat: 20.431, lng: 65.877 },
  { lat: 20.397, lng: 65.869 },
  { lat: 20.372, lng: 65.838 },
  { lat: 20.368, lng: 65.796 },
  { lat: 20.386, lng: 65.762 },
  { lat: 20.418, lng: 65.748 },
  { lat: 20.452, lng: 65.771 },
];

const SPILL_ORIGIN: LatLng = { lat: 20.447, lng: 65.795 };

export function getMockSpill(): Spill {
  return {
    id: 'MS-2026-0830-001',
    status: 'ACTIVE_INVESTIGATION',
    detectionConfidencePct: 94.7,
    estimatedAreaKm2: 18.42,
    estimatedAgeHours: 9.6,
    detectionSource: 'Sentinel-1 SAR',
    observedAtUtc: '2026-08-30T04:20:00Z',
    centroid: SPILL_CENTROID,
    polygon: { ring: SPILL_RING },
    origin: {
      location: SPILL_ORIGIN,
      estimatedAtUtc: '2026-08-29T18:44:00Z',
      confidencePct: 89.1,
    },
    drift: {
      backtrack: [
        { label: 'T-12h', location: { lat: 20.447, lng: 65.795 }, timestampUtc: '2026-08-29T16:20:00Z' },
        { label: 'T-8h', location: { lat: 20.438, lng: 65.804 }, timestampUtc: '2026-08-29T20:20:00Z' },
        { label: 'T-4h', location: { lat: 20.424, lng: 65.814 }, timestampUtc: '2026-08-30T00:20:00Z' },
        { label: 'NOW', location: SPILL_CENTROID, timestampUtc: '2026-08-30T04:20:00Z', isCurrent: true },
      ],
      forecast: [
        { label: 'NOW', location: SPILL_CENTROID, timestampUtc: '2026-08-30T04:20:00Z', isCurrent: true },
        { label: 'T+4h', location: { lat: 20.389, lng: 65.848 }, timestampUtc: '2026-08-30T08:20:00Z' },
        { label: 'T+8h', location: { lat: 20.361, lng: 65.879 }, timestampUtc: '2026-08-30T12:20:00Z' },
      ],
    },
  };
}

function getMockSatellite(): SatelliteObservation {
  return {
    platform: 'Sentinel-1',
    sensor: 'SAR (C-band)',
    acquisitionUtc: '2026-08-30T04:20:00Z',
    incidenceAngleDeg: 36.8,
    resolutionM: 10,
    cloudCover: null,
    confidencePct: 94.7,
    footprint: {
      corners: [
        { lat: 20.58, lng: 65.62 },
        { lat: 20.58, lng: 66.02 },
        { lat: 20.22, lng: 66.02 },
        { lat: 20.22, lng: 65.62 },
      ],
    },
  };
}

function getMockOceanographic(): OceanographicData {
  return {
    windDirectionDeg: 274,
    windSpeedKn: 18,
    currentDirectionDeg: 261,
    currentSpeedKn: 1.2,
    seaStateM: 2.1,
    temperatureC: 27.4,
  };
}

function getMockInvestigation(): Investigation {
  return {
    id: 'MS-2026-0830-001',
    operationName: 'OPERATION: BLUE HORIZON',
    sector: 'ARABIAN SEA / SECTOR 07',
    status: 'ACTIVE_INVESTIGATION',
    openedAtUtc: '2026-08-30T04:31:00Z',
  };
}

function getMockSystemStatus(): SystemStatus {
  return {
    satellite: 'ONLINE',
    ais: 'CONNECTED',
    weather: 'AVAILABLE',
    backend: 'MOCK MODE',
  };
}

// ---------------------------------------------------------------------------
// Mock vessels — fictional names & IMOs, internally consistent scoring
// ---------------------------------------------------------------------------

function getMockVessels(): Vessel[] {
  return [
    {
      id: 'v-blue-horizon',
      name: 'MT BLUE HORIZON',
      imo: '9418273',
      type: 'Chemical / Oil Tanker',
      flag: 'FICTIONAL',
      speedKn: 11.8,
      headingDeg: 274,
      draftM: 8.4,
      currentLocation: { lat: 20.436, lng: 65.828 },
      isSuspect: true,
      rank: 1,
      attribution: {
        attributionScorePct: 94.8,
        distanceNm: 2.8,
        timeDifferenceMinutes: 18,
        trajectoryMatchPct: 96,
        behaviorAnomaly: 'HIGH',
        risk: 'CRITICAL',
        breakdown: {
          spatialProximity: { score: 28, max: 30 },
          temporalCorrelation: { score: 25, max: 25 },
          trajectoryMatch: { score: 22, max: 25 },
          behaviorAnomaly: { score: 15, max: 20 },
        },
        correlation: { spatialPct: 96, temporalPct: 91, trajectoryPct: 94, behaviorPct: 87, overallPct: 94.8 },
      },
      anomalyEvents: [
        { timestampUtc: '2026-08-30T03:42:00Z', label: 'Normal transit', description: 'Steady course, 274°, 12.1 kn.', severity: 'INFO' },
        { timestampUtc: '2026-08-30T03:51:00Z', label: 'Speed reduction detected', description: 'Speed dropped from 12.1 kn to 6.4 kn over 3 minutes.', severity: 'WARNING' },
        { timestampUtc: '2026-08-30T04:02:00Z', label: 'Heading deviation', description: 'Course diverged 14° from filed route without AIS status change.', severity: 'WARNING' },
        { timestampUtc: '2026-08-30T04:08:00Z', label: 'Unusual maneuver', description: 'Two tight heading changes consistent with a hold-position pattern.', severity: 'CRITICAL' },
        { timestampUtc: '2026-08-30T04:18:00Z', label: 'AIS behavior anomaly', description: 'AIS transmission gap of 94 seconds, atypical for this vessel class.', severity: 'CRITICAL' },
        { timestampUtc: '2026-08-30T04:20:00Z', label: 'Spill observation', description: 'Sentinel-1 SAR pass detects slick 2.8 NM from vessel position.', severity: 'CRITICAL' },
        { timestampUtc: '2026-08-30T04:31:00Z', label: 'Course resumed', description: 'Vessel returns to 274° heading at 11.8 kn.', severity: 'INFO' },
      ],
    },
    {
      id: 'v-ocean-star',
      name: 'MV OCEAN STAR',
      imo: '9382716',
      type: 'Bulk Carrier',
      flag: 'FICTIONAL',
      speedKn: 13.2,
      headingDeg: 261,
      draftM: 11.1,
      currentLocation: { lat: 20.512, lng: 65.902 },
      isSuspect: true,
      rank: 2,
      attribution: {
        attributionScorePct: 82.4,
        distanceNm: 6.2,
        timeDifferenceMinutes: 41,
        trajectoryMatchPct: 87,
        behaviorAnomaly: 'MEDIUM',
        risk: 'HIGH',
        breakdown: {
          spatialProximity: { score: 22, max: 30 },
          temporalCorrelation: { score: 20, max: 25 },
          trajectoryMatch: { score: 20, max: 25 },
          behaviorAnomaly: { score: 12, max: 20 },
        },
        correlation: { spatialPct: 78, temporalPct: 80, trajectoryPct: 87, behaviorPct: 60, overallPct: 82.4 },
      },
      anomalyEvents: [
        { timestampUtc: '2026-08-30T03:20:00Z', label: 'Normal transit', description: 'Steady course, 261°, 13.4 kn.', severity: 'INFO' },
        { timestampUtc: '2026-08-30T04:01:00Z', label: 'Minor speed variance', description: 'Brief slowdown to 9.8 kn, resumed within 2 minutes.', severity: 'WARNING' },
        { timestampUtc: '2026-08-30T04:44:00Z', label: 'Course resumed', description: 'Vessel maintains 261° heading, no further anomalies.', severity: 'INFO' },
      ],
    },
    {
      id: 'v-eastern-glory',
      name: 'MV EASTERN GLORY',
      imo: '9274618',
      type: 'Container Ship',
      flag: 'FICTIONAL',
      speedKn: 16.7,
      headingDeg: 218,
      draftM: 9.7,
      currentLocation: { lat: 20.601, lng: 65.688 },
      isSuspect: true,
      rank: 3,
      attribution: {
        attributionScorePct: 64.1,
        distanceNm: 11.7,
        timeDifferenceMinutes: 74,
        trajectoryMatchPct: 69,
        behaviorAnomaly: 'LOW',
        risk: 'MEDIUM',
        breakdown: {
          spatialProximity: { score: 14, max: 30 },
          temporalCorrelation: { score: 16, max: 25 },
          trajectoryMatch: { score: 17, max: 25 },
          behaviorAnomaly: { score: 6, max: 20 },
        },
        correlation: { spatialPct: 52, temporalPct: 61, trajectoryPct: 69, behaviorPct: 30, overallPct: 64.1 },
      },
      anomalyEvents: [
        { timestampUtc: '2026-08-30T02:55:00Z', label: 'Normal transit', description: 'Steady course, 218°, 16.9 kn.', severity: 'INFO' },
        { timestampUtc: '2026-08-30T04:20:00Z', label: 'No anomaly at observation time', description: 'No deviation recorded around spill detection window.', severity: 'INFO' },
      ],
    },
    {
      id: 'v-sea-falcon',
      name: 'MV SEA FALCON',
      imo: '9563721',
      type: 'General Cargo',
      flag: 'FICTIONAL',
      speedKn: 10.4,
      headingDeg: 96,
      draftM: 6.9,
      currentLocation: { lat: 20.29, lng: 66.11 },
      isSuspect: true,
      rank: 4,
      attribution: {
        attributionScorePct: 48.6,
        distanceNm: 18.3,
        timeDifferenceMinutes: 96,
        trajectoryMatchPct: 54,
        behaviorAnomaly: 'LOW',
        risk: 'LOW',
        breakdown: {
          spatialProximity: { score: 10, max: 30 },
          temporalCorrelation: { score: 12, max: 25 },
          trajectoryMatch: { score: 14, max: 25 },
          behaviorAnomaly: { score: 5, max: 20 },
        },
        correlation: { spatialPct: 43, temporalPct: 48, trajectoryPct: 54, behaviorPct: 25, overallPct: 48.6 },
      },
      anomalyEvents: [
        { timestampUtc: '2026-08-30T02:35:00Z', label: 'Course adjustment', description: 'Minor course change during normal cargo transit.', severity: 'INFO' },
      ],
    },
  ];
}

function trackFromCurrent(vessel: Vessel, seedOffsets: LatLng[]): VesselTrack {
  const base = vessel.currentLocation;
  const points = seedOffsets.map((offset, i) => ({
    location: { lat: base.lat - offset.lat, lng: base.lng - offset.lng },
    timestampUtc: new Date(Date.parse('2026-08-30T04:20:00Z') - (seedOffsets.length - i) * 20 * 60 * 1000).toISOString(),
    speedKn: vessel.speedKn + (Math.random() * 1.4 - 0.7),
    headingDeg: vessel.headingDeg,
  }));
  points.push({
    location: base,
    timestampUtc: '2026-08-30T04:20:00Z',
    speedKn: vessel.speedKn,
    headingDeg: vessel.headingDeg,
  });
  return { vesselId: vessel.id, points };
}

const MOCK_TRACK_OFFSETS: Record<string, LatLng[]> = {
  'v-blue-horizon': [
    { lat: -0.09, lng: 0.14 },
    { lat: -0.06, lng: 0.1 },
    { lat: -0.03, lng: 0.06 },
    { lat: -0.01, lng: 0.02 },
  ],
  'v-ocean-star': [
    { lat: -0.11, lng: -0.09 },
    { lat: -0.07, lng: -0.06 },
    { lat: -0.03, lng: -0.03 },
  ],
  'v-eastern-glory': [
    { lat: -0.14, lng: 0.12 },
    { lat: -0.09, lng: 0.08 },
    { lat: -0.04, lng: 0.04 },
  ],
  'v-sea-falcon': [
    { lat: 0.1, lng: -0.16 },
    { lat: 0.06, lng: -0.1 },
    { lat: 0.02, lng: -0.04 },
  ],
};

// ---------------------------------------------------------------------------
// Public API surface consumed by components
// ---------------------------------------------------------------------------

export async function getSpillData(): Promise<Spill> {
  if (!USE_MOCK) {
    const { data } = await apiClient.get<Spill>('/spill');
    return data;
  }
  return withLatency(getMockSpill());
}

export async function getVessels(): Promise<Vessel[]> {
  if (!USE_MOCK) {
    const { data } = await apiClient.get<Vessel[]>('/vessels');
    return data;
  }
  return withLatency(getMockVessels(), 520);
}

export async function getVesselTrack(vesselId: string): Promise<VesselTrack> {
  if (!USE_MOCK) {
    const { data } = await apiClient.get<VesselTrack>(`/vessels/${vesselId}/track`);
    return data;
  }
  const vessels = getMockVessels();
  const vessel = vessels.find((v) => v.id === vesselId) ?? vessels[0];
  const offsets = MOCK_TRACK_OFFSETS[vesselId] ?? MOCK_TRACK_OFFSETS['v-blue-horizon'];
  return withLatency(trackFromCurrent(vessel, offsets), 300);
}

export async function getSatelliteData(): Promise<SatelliteObservation> {
  if (!USE_MOCK) {
    const { data } = await apiClient.get<SatelliteObservation>('/satellite');
    return data;
  }
  return withLatency(getMockSatellite());
}

export async function getOceanographicData(): Promise<OceanographicData> {
  if (!USE_MOCK) {
    const { data } = await apiClient.get<OceanographicData>('/ocean');
    return data;
  }
  return withLatency(getMockOceanographic(), 260);
}

export async function getInvestigation(): Promise<Investigation> {
  if (!USE_MOCK) {
    const { data } = await apiClient.get<Investigation>('/investigation');
    return data;
  }
  return withLatency(getMockInvestigation(), 200);
}

export async function getSystemStatus(): Promise<SystemStatus> {
  if (!USE_MOCK) {
    const { data } = await apiClient.get<SystemStatus>('/system-status');
    return data;
  }
  return withLatency(getMockSystemStatus(), 150);
}

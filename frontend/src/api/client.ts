import axios from 'axios';
import type {
  Spill,
  Vessel,
  VesselTrack,
  SatelliteObservation,
  OceanographicData,
  Investigation,
  SystemStatus,
  SurveillanceScanResult,
  SurveillanceScanParams,
  HistoricalSpillSummary,
  HistoricalSpillDetail,
  HistoricalWeather,
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
  return [];
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
    try {
      const { data } = await apiClient.get<Spill>('/spill');
      return data;
    } catch {
      // Backend /spill endpoint not implemented yet, fall back gracefully to simulation
    }
  }
  return withLatency(getMockSpill());
}

export async function getVessels(): Promise<Vessel[]> {
  if (!USE_MOCK) {
    try {
      const { data } = await apiClient.get<Vessel[]>('/vessels');
      return data;
    } catch {
      // Backend /vessels endpoint not implemented yet, fall back gracefully to simulation
    }
  }
  return withLatency(getMockVessels(), 520);
}

export async function getVesselTrack(vesselId: string): Promise<VesselTrack> {
  if (!USE_MOCK) {
    try {
      const { data } = await apiClient.get<VesselTrack>(`/vessels/${vesselId}/track`);
      return data;
    } catch {
      // Fall back to simulation track
    }
  }
  const vessels = getMockVessels();
  const vessel = vessels.find((v) => v.id === vesselId);
  if (!vessel) {
    return withLatency({ vesselId, points: [] }, 100);
  }
  const offsets = MOCK_TRACK_OFFSETS[vesselId] ?? MOCK_TRACK_OFFSETS['v-blue-horizon'];
  return withLatency(trackFromCurrent(vessel, offsets), 300);
}

export async function getSatelliteData(): Promise<SatelliteObservation> {
  if (!USE_MOCK) {
    try {
      const { data } = await apiClient.get<SatelliteObservation>('/satellite');
      return data;
    } catch {
      // Fall back gracefully to simulation
    }
  }
  return withLatency(getMockSatellite());
}

export async function getOceanographicData(): Promise<OceanographicData> {
  if (!USE_MOCK) {
    try {
      const { data } = await apiClient.get<OceanographicData>('/ocean');
      return data;
    } catch {
      // Fall back gracefully to simulation
    }
  }
  return withLatency(getMockOceanographic(), 260);
}

export async function getInvestigation(): Promise<Investigation> {
  if (!USE_MOCK) {
    try {
      const { data } = await apiClient.get<Investigation>('/investigation');
      return data;
    } catch {
      // Fall back gracefully to simulation
    }
  }
  return withLatency(getMockInvestigation(), 200);
}

export async function getSystemStatus(): Promise<SystemStatus> {
  const base = getMockSystemStatus();
  try {
    // 10s timeout accommodates Render free tier container spin-up
    const health = await apiClient.get('/health', { timeout: 10000 });
    if (health.status === 200) {
      return {
        ...base,
        backend: 'CONNECTED',
      };
    }
  } catch {
    // backend not running or cold-starting
  }
  return base;
}

// ---------------------------------------------------------------------------
// Surveillance scan API
// ---------------------------------------------------------------------------

export async function triggerSurveillanceScan(
  params: SurveillanceScanParams | string,
  drill: boolean = false,
): Promise<SurveillanceScanResult> {
  const payload = typeof params === 'string' ? { zone: params, drill } : params;
  // Always call the real backend for surveillance scans (no mock)
  const { data } = await apiClient.post<SurveillanceScanResult>(
    '/surveillance/scan',
    payload,
    { timeout: 65000 }, // Pipeline can take ~10-15s due to Copernicus API
  );
  return data;
}

// ---------------------------------------------------------------------------
// Historical Spills & Incident Archive API
// ---------------------------------------------------------------------------

export async function getHistoricalSpills(
  limit: number = 50,
): Promise<{ spills: HistoricalSpillSummary[]; total: number }> {
  try {
    const { data } = await apiClient.get<{ spills: HistoricalSpillSummary[]; total: number }>(
      '/spills',
      { params: { limit } },
    );
    return data;
  } catch (err) {
    console.warn('Failed to load historical spills from backend:', err);
    return { spills: [], total: 0 };
  }
}

export async function getHistoricalSpillDetail(
  spillId: number,
  originLat?: number,
  originLon?: number,
): Promise<HistoricalSpillDetail> {
  const params: Record<string, any> = {};
  if (originLat !== undefined && originLon !== undefined) {
    params.origin_lat = originLat;
    params.origin_lon = originLon;
  }
  const { data } = await apiClient.get<HistoricalSpillDetail>(`/spills/${spillId}`, { params });
  return data;
}

// ---------------------------------------------------------------------------
// Historical Weather & Marine Oceanographic API
// ---------------------------------------------------------------------------

export async function getHistoricalWeather(
  lat: number,
  lon: number,
  date?: string,
): Promise<HistoricalWeather> {
  try {
    const { data } = await apiClient.get<HistoricalWeather>('/weather/historical', {
      params: { lat, lon, date },
      timeout: 10000,
    });
    return data;
  } catch (err) {
    console.warn('Weather API failed, using fallback oceanographic model:', err);
    // Graceful fallback to realistic marine conditions
    return {
      latitude: lat,
      longitude: lon,
      date: date || new Date().toISOString().slice(0, 10),
      wind_speed_kmh: 22.0,
      wind_direction_deg: 120.0,
      current_speed_kmh: 1.2,
      current_direction_deg: 260.0,
      wave_height_m: 1.6,
      sea_temperature_c: 26.0,
      conditions: 'Moderate Maritime Breeze',
      source: 'client_fallback',
      cached: false,
    };
  }
}



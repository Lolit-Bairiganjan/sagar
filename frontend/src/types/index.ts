// ---------------------------------------------------------------------------
// Shared geo primitives
// ---------------------------------------------------------------------------

export interface LatLng {
  lat: number;
  lng: number;
}

// ---------------------------------------------------------------------------
// Spill domain
// ---------------------------------------------------------------------------

export interface SpillPolygon {
  /** Ordered ring of coordinates describing the (irregular) slick outline. */
  ring: LatLng[];
}

export interface SpillOrigin {
  location: LatLng;
  estimatedAtUtc: string;
  confidencePct: number;
}

export interface DriftNode {
  label: string; // e.g. "T-12h", "NOW", "T+8h"
  location: LatLng;
  timestampUtc: string;
  isCurrent?: boolean;
}

export interface DriftPath {
  backtrack: DriftNode[];
  forecast: DriftNode[];
}

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface Spill {
  id: string;
  status: 'ACTIVE_INVESTIGATION' | 'RESOLVED' | 'MONITORING';
  detectionConfidencePct: number;
  estimatedAreaKm2: number;
  estimatedAgeHours: number;
  detectionSource: string;
  observedAtUtc: string;
  centroid: LatLng;
  polygon: SpillPolygon;
  origin: SpillOrigin;
  drift: DriftPath;
}

// ---------------------------------------------------------------------------
// Satellite domain
// ---------------------------------------------------------------------------

export interface SatelliteFootprint {
  /** Rectangle corners describing the SAR observation swath. */
  corners: LatLng[];
}

export interface SatelliteObservation {
  platform: string;
  sensor: string;
  acquisitionUtc: string;
  incidenceAngleDeg: number;
  resolutionM: number;
  cloudCover: string | null;
  confidencePct: number;
  footprint: SatelliteFootprint;
}

// ---------------------------------------------------------------------------
// Vessel / AIS domain
// ---------------------------------------------------------------------------

export interface VesselTrackPoint {
  location: LatLng;
  timestampUtc: string;
  speedKn: number;
  headingDeg: number;
}

export interface AnomalyEvent {
  timestampUtc: string;
  label: string;
  description: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
}

export interface VesselAttribution {
  attributionScorePct: number;
  distanceNm: number;
  timeDifferenceMinutes: number;
  trajectoryMatchPct: number;
  behaviorAnomaly: 'LOW' | 'MEDIUM' | 'HIGH';
  risk: RiskLevel;
  breakdown: {
    spatialProximity: { score: number; max: number };
    temporalCorrelation: { score: number; max: number };
    trajectoryMatch: { score: number; max: number };
    behaviorAnomaly: { score: number; max: number };
  };
  correlation: {
    spatialPct: number;
    temporalPct: number;
    trajectoryPct: number;
    behaviorPct: number;
    overallPct: number;
  };
}

export interface Vessel {
  id: string;
  name: string;
  imo: string;
  type: string;
  flag: string;
  speedKn: number;
  headingDeg: number;
  draftM: number;
  currentLocation: LatLng;
  isSuspect: boolean;
  rank: number | null;
  attribution: VesselAttribution | null;
  anomalyEvents: AnomalyEvent[];
}

export interface VesselTrack {
  vesselId: string;
  points: VesselTrackPoint[];
}

// ---------------------------------------------------------------------------
// Oceanographic / weather domain
// ---------------------------------------------------------------------------

export interface OceanographicData {
  windDirectionDeg: number;
  windSpeedKn: number;
  currentDirectionDeg: number;
  currentSpeedKn: number;
  seaStateM: number;
  temperatureC: number;
}

export interface WeatherData {
  conditions: string;
  visibilityKm: number;
  updatedAtUtc: string;
}

// ---------------------------------------------------------------------------
// Investigation / system domain
// ---------------------------------------------------------------------------

export interface Investigation {
  id: string;
  operationName: string;
  sector: string;
  status: Spill['status'];
  openedAtUtc: string;
}

export type SystemLinkStatus = 'ONLINE' | 'CONNECTED' | 'AVAILABLE' | 'MOCK MODE' | 'OFFLINE';

export interface SystemStatus {
  satellite: SystemLinkStatus;
  ais: SystemLinkStatus;
  weather: SystemLinkStatus;
  backend: SystemLinkStatus;
}

export type TimelineToken = 'T-12h' | 'T-8h' | 'T-4h' | 'T-2h' | 'NOW' | 'T+2h' | 'T+4h' | 'T+8h';

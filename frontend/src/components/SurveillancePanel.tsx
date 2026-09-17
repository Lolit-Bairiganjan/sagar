import { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Radar,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ChevronDown,
  ChevronUp,
  Flame,
  Globe,
  Crosshair,
  Pencil,
  Calendar,
  Layers,
  Sliders,
  Archive,
  Maximize2,
  Ship,
  Clock,
  ShieldAlert,
  Radio,
  Droplets,
  Compass,
  Wind,
} from 'lucide-react';
import { soundEngine } from '../utils/soundEngine';
import type { SurveillanceScanResult, SurveillanceScanParams, HistoricalWeather } from '../types';
import type { ReverseDriftResult } from '../utils/driftEngine';
import { triggerSurveillanceScan } from '../api/client';

// ---------------------------------------------------------------------------
// Point-to-AOI Calculator: parses lat/lon points and builds square bounding boxes
// ---------------------------------------------------------------------------

export function parsePointCoordinate(raw: string): { lat: number; lon: number } | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();

  // Pattern 1: Lat with N/S, Lon with E/W (e.g. 17.512°N, 56.038°E or 17.512 N, 56.038 W)
  const dirMatch = trimmed.match(
    /([+-]?\d+(?:\.\d+)?)\s*°?\s*([NSns])\s*[,/;\s]\s*([+-]?\d+(?:\.\d+)?)\s*°?\s*([EWew])/
  );
  if (dirMatch) {
    let lat = parseFloat(dirMatch[1]);
    if (dirMatch[2].toUpperCase() === 'S') lat = -Math.abs(lat);
    let lon = parseFloat(dirMatch[3]);
    if (dirMatch[4].toUpperCase() === 'W') lon = -Math.abs(lon);
    if (!isNaN(lat) && !isNaN(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
      return { lat, lon };
    }
  }

  // Pattern 2: Lon with E/W, Lat with N/S (e.g. 56.038°E, 17.512°N)
  const dirMatchRev = trimmed.match(
    /([+-]?\d+(?:\.\d+)?)\s*°?\s*([EWew])\s*[,/;\s]\s*([+-]?\d+(?:\.\d+)?)\s*°?\s*([NSns])/
  );
  if (dirMatchRev) {
    let lon = parseFloat(dirMatchRev[1]);
    if (dirMatchRev[2].toUpperCase() === 'W') lon = -Math.abs(lon);
    let lat = parseFloat(dirMatchRev[3]);
    if (dirMatchRev[4].toUpperCase() === 'S') lat = -Math.abs(lat);
    if (!isNaN(lat) && !isNaN(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
      return { lat, lon };
    }
  }

  // Pattern 3: Standard decimal pair (e.g. 17.512, 56.038 or -20.45 57.75)
  const cleaned = trimmed.replace(/[°[\]()]/g, '');
  const parts = cleaned.split(/[,;\s]+/).map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const p1 = parseFloat(parts[0]);
    const p2 = parseFloat(parts[1]);
    if (!isNaN(p1) && !isNaN(p2)) {
      if (Math.abs(p1) <= 90 && Math.abs(p2) <= 180) {
        return { lat: p1, lon: p2 };
      }
    }
  }

  return null;
}

export function calculatePointToBbox(
  lat: number,
  lon: number,
  spanKm: number = 25
): [number, number, number, number] {
  const halfSideKm = spanKm / 2;
  const dLat = halfSideKm / 111.0;
  const radLat = (lat * Math.PI) / 180;
  const cosVal = Math.max(Math.cos(radLat), 0.01);
  const dLon = halfSideKm / (111.0 * cosVal);

  const minLon = Math.max(-180, Math.min(180, Number((lon - dLon).toFixed(4))));
  const maxLon = Math.max(-180, Math.min(180, Number((lon + dLon).toFixed(4))));
  const minLat = Math.max(-90, Math.min(90, Number((lat - dLat).toFixed(4))));
  const maxLat = Math.max(-90, Math.min(90, Number((lat + dLat).toFixed(4))));

  return [minLon, minLat, maxLon, maxLat];
}

// ---------------------------------------------------------------------------
// Day-Month-Year (DD-MM-YYYY) Date Formatting Helpers
// ---------------------------------------------------------------------------

export function isoToDmy(iso: string): string {
  if (!iso) return '';
  const parts = iso.split('-');
  if (parts.length === 3) {
    return `${parts[2].padStart(2, '0')}-${parts[1].padStart(2, '0')}-${parts[0]}`;
  }
  return iso;
}

export function dmyToIso(dmy: string): string | null {
  if (!dmy) return null;
  const cleaned = dmy.replace(/[/.]/g, '-').trim();
  const parts = cleaned.split('-');
  if (parts.length === 3) {
    const day = parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    const year = parts[2];
    if (year.length === 4) {
      const dNum = parseInt(day, 10);
      const mNum = parseInt(month, 10);
      if (dNum >= 1 && dNum <= 31 && mNum >= 1 && mNum <= 12) {
        return `${year}-${month}-${day}`;
      }
    }
  }
  return null;
}

export interface ZoneConfig {
  key: string;
  label: string;
  bbox: [number, number, number, number];
  description: string;
  timeWindow?: [string, string];
}

export const STRATEGIC_ZONES: ZoneConfig[] = [
  // Historical Ground Truth Incident (Real Sentinel-1 SAR Oil Slick)
  {
    key: 'wakashio_mauritius',
    label: 'MV Wakashio Spill (Mauritius 2020)',
    bbox: [57.65, -20.55, 57.85, -20.35],
    description: 'Real 2020 bunker fuel spill in Pointe d\'Esny lagoon (Ground Truth)',
    timeWindow: ['2020-08-05', '2020-08-15'],
  },
  {
    key: 'baniyas_syria',
    label: 'Baniyas Refinery Spill (Mediterranean 2021)',
    bbox: [35.70, 35.15, 36.00, 35.45],
    description: 'Real 2021 fuel oil spill off Syrian coast / Cyprus (Ground Truth)',
    timeWindow: ['2021-08-25', '2021-08-31'],
  },
  {
    key: 'tobago_barge',
    label: 'Tobago Mystery Barge Spill (Caribbean 2024)',
    bbox: [-60.85, 11.10, -60.65, 11.25],
    description: 'Real 2024 overturned barge bunker spill off southern Tobago (Ground Truth)',
    timeWindow: ['2024-02-07', '2024-02-14'],
  },
  {
    key: 'novorossiysk_cpc',
    label: 'CPC Marine Terminal Spill (Black Sea 2021)',
    bbox: [37.45, 44.55, 37.75, 44.75],
    description: 'Real 2021 Caspian Pipeline tanker loading crude leak (Ground Truth)',
    timeWindow: ['2021-08-07', '2021-08-10'],
  },
  // Global Critical Chokepoints & International Tanker Corridors
  {
    key: 'strait_of_hormuz',
    label: 'Strait of Hormuz (Persian Gulf)',
    bbox: [56.10, 26.20, 56.65, 26.65],
    description: "Persian Gulf crude export artery (Global Chokepoint)",
  },
  {
    key: 'singapore_strait',
    label: 'Singapore & Malacca Strait',
    bbox: [103.65, 1.15, 104.15, 1.45],
    description: 'East Asia crude artery & busy anchorage (Global Chokepoint)',
  },
  {
    key: 'bab_el_mandeb',
    label: 'Bab-el-Mandeb & Red Sea',
    bbox: [43.15, 12.50, 43.65, 13.00],
    description: 'Southern entrance to Suez Canal (Global Chokepoint)',
  },
  {
    key: 'english_channel',
    label: 'Strait of Dover (English Channel)',
    bbox: [1.15, 50.85, 1.75, 51.25],
    description: 'Busiest commercial shipping gateway in Europe',
  },
  {
    key: 'gulf_of_mexico',
    label: 'Gulf of Mexico (Mississippi Canyon)',
    bbox: [-90.40, 28.55, -89.80, 29.15],
    description: 'Major offshore crude platforms & US Gulf tanker lanes',
  },
  {
    key: 'north_sea',
    label: 'North Sea (Brent Petroleum Field)',
    bbox: [1.85, 56.20, 2.45, 56.80],
    description: 'Northern European offshore drilling & tanker routes',
  },
  {
    key: 'bosphorus_strait',
    label: 'Bosphorus Strait (Black Sea)',
    bbox: [29.00, 41.10, 29.35, 41.35],
    description: 'Black Sea & Mediterranean crude corridor (Eurasia)',
  },
  {
    key: 'panama_approach',
    label: 'Panama Canal Approach (Pacific)',
    bbox: [-79.70, 8.70, -79.35, 9.10],
    description: 'Pacific entrance to Panama Canal (Americas)',
  },
  // Indian Ocean & Regional Strategic EEZ Zones
  {
    key: 'mumbai_high',
    label: 'Mumbai High Offshore',
    bbox: [71.25, 19.35, 71.55, 19.65],
    description: 'Offshore crude platforms & western tanker lanes',
  },
  {
    key: 'gulf_of_kutch',
    label: 'Gulf of Kutch (Kandla / Jamnagar)',
    bbox: [69.20, 22.30, 69.70, 22.70],
    description: 'Crude import SPM terminals & refinery cluster',
  },
  {
    key: 'gulf_of_khambhat',
    label: 'Gulf of Khambhat (Dahej / Hazira)',
    bbox: [72.10, 20.80, 72.70, 21.40],
    description: 'Petrochemical corridor & LNG transshipment',
  },
  {
    key: 'goa_coast',
    label: 'Goa & Konkan Coast',
    bbox: [73.40, 14.80, 73.90, 15.30],
    description: 'Central western EEZ coastal transit route',
  },
  {
    key: 'cochin_lakshadweep',
    label: 'Cochin & Lakshadweep Sea',
    bbox: [75.80, 9.70, 76.30, 10.20],
    description: 'South Arabian Sea crude corridor',
  },
  {
    key: 'palk_strait',
    label: 'Palk Strait & Gulf of Mannar',
    bbox: [79.20, 9.00, 79.80, 9.50],
    description: 'Indo-Sri Lanka maritime border corridor',
  },
  {
    key: 'chennai_port',
    label: 'Chennai & Ennore Anchorage',
    bbox: [80.20, 13.00, 80.70, 13.50],
    description: 'Coromandel Coast petroleum anchorage',
  },
  {
    key: 'vizag_anchorage',
    label: 'Visakhapatnam Naval & Oil Anchorage',
    bbox: [83.20, 17.50, 83.70, 18.00],
    description: 'Eastern Naval Command & refinery terminal',
  },
  {
    key: 'paradip_dhamra',
    label: 'Paradip & Dhamra (Bay of Bengal)',
    bbox: [86.60, 20.10, 87.10, 20.60],
    description: 'Major bulk crude & ore carrier gateway',
  },
  {
    key: 'sundarbans_haldia',
    label: 'Haldia & Sundarbans Approach',
    bbox: [87.90, 21.30, 88.50, 21.80],
    description: 'Hooghly river entrance & coastal navigation',
  },
  {
    key: 'malacca_approach',
    label: 'Great Nicobar & Malacca Approach',
    bbox: [93.60, 6.40, 94.10, 6.90],
    description: "World's busiest crude tanker chokepoint",
  },
];

export const INDIAN_OCEAN_ZONES = STRATEGIC_ZONES;

// Helper to compute geographic area in km2
export function calculateAreaKm2(bbox: [number, number, number, number]): number {
  const [minLon, minLat, maxLon, maxLat] = bbox;
  const avgLat = ((minLat + maxLat) / 2) * (Math.PI / 180);
  const dLatKm = Math.abs(maxLat - minLat) * 111.0;
  const dLonKm = Math.abs(maxLon - minLon) * 111.0 * Math.cos(avgLat);
  return Math.round(dLatKm * dLonKm);
}

interface SurveillancePanelProps {
  isLight?: boolean;
  onScanComplete?: (result: SurveillanceScanResult) => void;
  customBbox: [string, string, string, string];
  onCustomBboxChange: (bbox: [string, string, string, string]) => void;
  isDrawingBox: boolean;
  onToggleDrawBox: () => void;
  onOpenHistory?: () => void;
  onTargetAoiChange?: (bbox: [number, number, number, number], label: string) => void;
  selectedSpillIdx?: number;
  onSelectSpillIdx?: (idx: number) => void;
  slickWeather?: HistoricalWeather | null;
  slickDrift?: ReverseDriftResult | null;
}

export default function SurveillancePanel({
  isLight = false,
  onScanComplete,
  customBbox,
  onCustomBboxChange,
  isDrawingBox,
  onToggleDrawBox,
  onOpenHistory,
  onTargetAoiChange,
  selectedSpillIdx = 0,
  onSelectSpillIdx,
  slickWeather = null,
  slickDrift = null,
}: SurveillancePanelProps) {
  const [mode, setMode] = useState<'preset' | 'custom'>('preset');
  const [selectedZoneKey, setSelectedZoneKey] = useState<string>('mumbai_high');
  const [scanningType, setScanningType] = useState<'live' | 'drill' | null>(null);
  const [results, setResults] = useState<Record<string, SurveillanceScanResult>>({});
  const [error, setError] = useState<string | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);

  // Temporal bounds state & presets
  const [timePreset, setTimePreset] = useState<'latest' | '3d' | '7d' | 'custom'>('latest');
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState<string>(() => new Date().toISOString().slice(0, 10));

  // Sensor selection and optical cloud cover slider
  const [sensor, setSensor] = useState<'Sentinel-1 SAR' | 'Sentinel-2 MSI'>('Sentinel-1 SAR');
  const [cloudCover, setCloudCover] = useState<number>(10);
  const [showAllSuspects, setShowAllSuspects] = useState(true);

  const selectedZone =
    INDIAN_OCEAN_ZONES.find((z) => z.key === selectedZoneKey) || INDIAN_OCEAN_ZONES[0];
  const activeKey = mode === 'preset' ? selectedZoneKey : 'custom';
  const activeResult = results[activeKey];

  // Calculate bounding box area and enforce physical limits (Cap at 2,500 km²)
  const numericBbox = useMemo<[number, number, number, number] | null>(() => {
    if (mode === 'preset') return selectedZone.bbox;
    const nums = customBbox.map((v) => parseFloat(v));
    if (nums.some(isNaN)) return null;
    return [
      Math.min(nums[0], nums[2]),
      Math.min(nums[1], nums[3]),
      Math.max(nums[0], nums[2]),
      Math.max(nums[1], nums[3]),
    ];
  }, [mode, selectedZone, customBbox]);

  const areaKm2 = useMemo(() => {
    if (!numericBbox) return 0;
    return calculateAreaKm2(numericBbox);
  }, [numericBbox]);

  // Safeguards: Max 2,500 km2 for real-time un-tiled Copernicus queries
  const isAreaExceeded = areaKm2 > 2500;

  // Dynamic Downsampling calculation to maintain within 2,500 x 2,500 px Process API limits
  const resolutionInfo = useMemo(() => {
    if (areaKm2 <= 625) {
      return { res: '10m / pixel', label: 'Full Native SAR Resolution', badge: '10m' };
    } else if (areaKm2 <= 1500) {
      return { res: '20m / pixel', label: 'Dynamic Downsampled (Optimized)', badge: '20m' };
    } else {
      return { res: '30m / pixel', label: 'Downsampled to stay within 2,500 px', badge: '30m' };
    }
  }, [areaKm2]);

  // When drawing mode is activated or box is drawn, automatically switch mode to custom
  useEffect(() => {
    if (isDrawingBox) {
      setMode('custom');
    }
  }, [isDrawingBox]);

  // Synchronized text input states for Day-Month-Year (DD-MM-YYYY) display
  const [startDateDmy, setStartDateDmy] = useState<string>(() => isoToDmy(startDate));
  const [endDateDmy, setEndDateDmy] = useState<string>(() => isoToDmy(endDate));
  const startPickerRef = useRef<HTMLInputElement>(null);
  const endPickerRef = useRef<HTMLInputElement>(null);

  // Sync DMY display strings whenever underlying ISO date state updates (presets, zone switches, etc.)
  useEffect(() => {
    setStartDateDmy(isoToDmy(startDate));
  }, [startDate]);

  useEffect(() => {
    setEndDateDmy(isoToDmy(endDate));
  }, [endDate]);

  // Synchronize target AOI to MapView for animated camera fly-to & target bounding box preview
  useEffect(() => {
    if (numericBbox) {
      const label =
        mode === 'preset'
          ? selectedZone.label
          : `Custom AOI [${numericBbox.join(', ')}]`;
      onTargetAoiChange?.(numericBbox, label);
    }
  }, [numericBbox, mode, selectedZone, onTargetAoiChange]);

  // Handle Start Date changes (from DD-MM-YYYY typing or calendar picker)
  const handleStartDateChange = (val: string) => {
    let iso: string | null = null;
    const normalized = val.replace(/\//g, '-');
    if (normalized.includes('-')) {
      const parts = normalized.split('-');
      if (parts[0]?.length === 4) {
        // YYYY-MM-DD (from native date picker)
        iso = normalized;
        setStartDateDmy(isoToDmy(normalized));
      } else if (parts[2]?.length === 4) {
        // DD-MM-YYYY (typed)
        setStartDateDmy(val);
        iso = dmyToIso(normalized);
      } else {
        setStartDateDmy(val);
      }
    } else {
      setStartDateDmy(val);
    }

    if (iso) {
      setStartDate(iso);
      setTimePreset('custom');
      try {
        const parts = iso.split('-');
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        const d = new Date(Date.UTC(y, m, day + 8));
        const endIso = d.toISOString().slice(0, 10);
        setEndDate(endIso);
        setEndDateDmy(isoToDmy(endIso));
      } catch {
        // ignore
      }
    }
  };

  const handleEndDateChange = (val: string) => {
    setTimePreset('custom');
    const normalized = val.replace(/\//g, '-');
    if (normalized.includes('-')) {
      const parts = normalized.split('-');
      if (parts[0]?.length === 4) {
        // YYYY-MM-DD (from native date picker)
        setEndDate(normalized);
        setEndDateDmy(isoToDmy(normalized));
      } else if (parts[2]?.length === 4) {
        // DD-MM-YYYY (typed)
        setEndDateDmy(val);
        const iso = dmyToIso(normalized);
        if (iso) setEndDate(iso);
      } else {
        setEndDateDmy(val);
      }
    } else {
      setEndDateDmy(val);
    }
  };

  // Handle Preset Changes for Temporal Window
  const handlePresetChange = (preset: 'latest' | '3d' | '7d' | 'custom') => {
    setTimePreset(preset);
    const now = new Date();
    setEndDate(now.toISOString().slice(0, 10));

    if (preset === '3d') {
      const past = new Date();
      past.setDate(now.getDate() - 3);
      setStartDate(past.toISOString().slice(0, 10));
    } else if (preset === '7d') {
      const past = new Date();
      past.setDate(now.getDate() - 7);
      setStartDate(past.toISOString().slice(0, 10));
    } else if (preset === 'latest') {
      const past = new Date();
      past.setDate(now.getDate() - 8);
      setStartDate(past.toISOString().slice(0, 10));
    }
  };

  const handleScan = async (isDrill: boolean = false) => {
    if (scanningType) return;
    soundEngine.playBubbleHover();
    setScanningType(isDrill ? 'drill' : 'live');
    setError(null);

    try {
      if (isAreaExceeded && mode === 'custom') {
        throw new Error(
          `Selected area is too large (${areaKm2} km²). Sentinel-1 Process API caps real-time scans at 2,500 km² (~50 km × 50 km). Please narrow your Area of Interest.`
        );
      }

      // Automated 8-day window safeguard: If end date is > 14 days after start date,
      // automatically clamp to startDate + 8 days to avoid retrieving clean future satellite scenes
      let clampedEndDate = endDate;
      if (startDate && endDate) {
        try {
          const dStart = new Date(startDate);
          const dEnd = new Date(endDate);
          const diffDays = Math.round((dEnd.getTime() - dStart.getTime()) / (1000 * 3600 * 24));
          if (diffDays > 14) {
            const autoEnd = new Date(dStart);
            autoEnd.setDate(autoEnd.getDate() + 8);
            clampedEndDate = autoEnd.toISOString().slice(0, 10);
          }
        } catch {
          // ignore
        }
      }

      // In custom AOI mode, or whenever dates are customized or timePreset is not 'latest':
      // Always forward the user's dates to Copernicus SAR pipeline
      const isLatestPresetMode = mode === 'preset' && timePreset === 'latest';
      const startIso = !isLatestPresetMode && startDate ? `${startDate}T00:00:00Z` : undefined;
      const endIso = !isLatestPresetMode && clampedEndDate ? `${clampedEndDate}T23:59:59Z` : undefined;

      let payload: SurveillanceScanParams;
      if (mode === 'preset') {
        payload = {
          zone: selectedZone.key,
          drill: isDrill,
          start_date: startIso,
          end_date: endIso,
          sensor,
          cloud_cover: cloudCover,
        };
      } else {
        if (!numericBbox) {
          throw new Error('Please enter valid numeric coordinates for [Min Lon, Min Lat, Max Lon, Max Lat]');
        }
        if (numericBbox[0] === numericBbox[2] || numericBbox[1] === numericBbox[3]) {
          throw new Error('Bounding box must have a non-zero width and height');
        }

        payload = {
          bbox: numericBbox,
          drill: isDrill,
          start_date: startIso,
          end_date: endIso,
          sensor,
          cloud_cover: cloudCover,
        };
      }

      const result = await triggerSurveillanceScan(payload);
      setResults((prev) => ({ ...prev, [activeKey]: result }));
      onScanComplete?.(result);
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || 'Scan failed';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setScanningType(null);
    }
  };

  const isClean = activeResult?.status === 'ZONE_CLEAN';
  const hasDetections = activeResult?.status === 'ANOMALY_DETECTED';

  return (
    <div
      className={`pointer-events-auto flex flex-col border shadow-xl backdrop-blur-md transition-all duration-200 ${
        isLight
          ? 'bg-white/95 border-black/15 text-[#14161B]'
          : 'bg-[#10131A]/95 border-[#2D323E] text-white'
      }`}
      style={{ width: isMinimized ? 300 : 440 }}
    >
      {/* ─── Header: LIVE SURVEILLANCE [Sentinel-1 SAR] [19 Zones] [Custom AOI] ─── */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/5 select-none">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Radar size={13} className="text-[#FF6600] animate-pulse shrink-0" />
          <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#FF6600]">
            Live Surveillance
          </span>
          <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-[#FF6600]/10 text-[#FF6600] border border-[#FF6600]/30 font-semibold">
            {sensor}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {!isMinimized && (
            <div
              className={`flex items-center rounded p-0.5 text-[9px] font-mono border ${
                isLight ? 'bg-black/5 border-black/15' : 'bg-black/40 border-white/10'
              }`}
            >
              <button
                onClick={() => {
                  soundEngine.playBubbleHover();
                  setMode('preset');
                }}
                className={`px-2 py-0.5 rounded-sm transition-colors cursor-pointer ${
                  mode === 'preset'
                    ? isLight
                      ? 'bg-[#FF6600] text-white font-bold shadow-sm'
                      : 'bg-[#FF6600] text-black font-bold'
                    : isLight
                    ? 'text-[#374151] hover:text-black font-semibold'
                    : 'text-[#8E95A5] hover:text-white'
                }`}
              >
                {STRATEGIC_ZONES.length} Zones
              </button>
              <button
                onClick={() => {
                  soundEngine.playBubbleHover();
                  setMode('custom');
                }}
                className={`px-2 py-0.5 rounded-sm transition-colors cursor-pointer ${
                  mode === 'custom'
                    ? isLight
                      ? 'bg-[#FF6600] text-white font-bold shadow-sm'
                      : 'bg-[#FF6600] text-black font-bold'
                    : isLight
                    ? 'text-[#374151] hover:text-black font-semibold'
                    : 'text-[#8E95A5] hover:text-white'
                }`}
              >
                Custom AOI
              </button>
            </div>
          )}

          <button
            onClick={() => setIsMinimized((m) => !m)}
            className="text-[#8E95A5] hover:text-white transition-colors cursor-pointer p-0.5"
            title={isMinimized ? 'Expand panel' : 'Minimize panel'}
          >
            {isMinimized ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>
        </div>
      </div>

      {/* Expanded Body */}
      <AnimatePresence initial={false}>
        {!isMinimized && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex flex-col gap-2.5 p-3 max-h-[calc(100vh-140px)] overflow-y-auto"
          >
            {/* ─── Mode 1: 19 Predefined Strategic Maritime Zones ─── */}
            {mode === 'preset' ? (
              <div className="flex flex-col gap-1">
                <label className="text-[9px] font-mono uppercase text-[#8E95A5] flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Globe size={10} className="text-[#FF6600]" /> Global Chokepoints & Tanker Lanes:
                  </span>
                  <span className="text-[8px] text-[#6B7280]">
                    Area: ~{areaKm2} km²
                  </span>
                </label>
                <select
                  value={selectedZoneKey}
                  onChange={(e) => {
                    soundEngine.playBubbleHover();
                    const newKey = e.target.value;
                    setSelectedZoneKey(newKey);
                    const matched = INDIAN_OCEAN_ZONES.find((z) => z.key === newKey);
                    if (matched?.timeWindow) {
                      setStartDate(matched.timeWindow[0]);
                      setEndDate(matched.timeWindow[1]);
                      setTimePreset('custom');
                    }
                  }}
                  className={`border px-2 py-1.5 text-[11px] font-mono font-semibold rounded cursor-pointer outline-none transition-colors ${
                    isLight
                      ? 'bg-white border-black/20 text-[#14161B] focus:border-[#FF6600]'
                      : 'bg-[#181B22] border-[#2D323E] text-white focus:border-[#FF6600]'
                  }`}
                >
                  {INDIAN_OCEAN_ZONES.map((z) => (
                    <option key={z.key} value={z.key}>
                      📍 {z.label}
                    </option>
                  ))}
                </select>
                <div className="flex items-center justify-between text-[9px] font-mono px-1">
                  <span className="truncate text-[#8E95A5]">{selectedZone.description}</span>
                  <span className={`shrink-0 ${isLight ? 'text-gray-500' : 'text-[#4B5262]'}`}>
                    [{selectedZone.bbox.join(', ')}]
                  </span>
                </div>
              </div>
            ) : (
              /* ─── Mode 2: CUSTOM BOUNDING BOX & MAP DRAW ─── */
              <div className="flex flex-col gap-2">
                {/* 4-Corner Bounding Box Coordinates with Map Draw Sync */}
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <label
                      className={`text-[9px] font-mono uppercase flex items-center gap-1 ${
                        isLight ? 'text-[#1F2937] font-semibold' : 'text-[#8E95A5]'
                      }`}
                    >
                      <Crosshair size={10} className="text-[#FF6600]" /> Bounding Box [W, S, E, N]:
                    </label>

                    {/* Interactive Map Draw Button */}
                    <button
                      onClick={() => {
                        soundEngine.playBubbleHover();
                        onToggleDrawBox();
                      }}
                      className={`flex items-center gap-1 px-2 py-0.5 font-mono text-[9px] font-bold border rounded transition-all cursor-pointer ${
                        isDrawingBox
                          ? 'border-[#FF6600] bg-[#FF6600] text-black shadow-[0_0_8px_rgba(255,102,0,0.6)] animate-pulse'
                          : 'border-[#FF6600]/40 bg-[#FF6600]/10 text-[#FF6600] hover:bg-[#FF6600]/20'
                      }`}
                      title="Click and drag on the map to define a target surveillance area"
                    >
                      <Pencil size={9} />
                      {isDrawingBox ? 'DRAWING (DRAG MAP)...' : 'DRAW AOI ON MAP'}
                    </button>
                  </div>

                  {/* Coordinate Inputs: Min Lon, Min Lat, Max Lon, Max Lat */}
                  <div className="grid grid-cols-4 gap-1">
                    {(['Min Lon (W)', 'Min Lat (S)', 'Max Lon (E)', 'Max Lat (N)'] as const).map(
                      (label, i) => (
                        <div key={label} className="flex flex-col gap-0.5">
                          <span className={`text-[8px] font-mono truncate ${isLight ? 'text-gray-600' : 'text-[#6B7280]'}`}>
                            {label}
                          </span>
                          <input
                            type="text"
                            value={customBbox[i]}
                            onChange={(e) => {
                              const val = e.target.value;
                              const next = [...customBbox] as [string, string, string, string];
                              next[i] = val;
                              onCustomBboxChange(next);
                            }}
                            className={`border px-1 py-1 text-[10px] font-mono text-center rounded outline-none transition-colors ${
                              isLight
                                ? 'bg-white border-black/30 text-[#14161B] font-semibold focus:border-[#FF6600]'
                                : 'bg-[#181B22] border-[#2D323E] text-white focus:border-[#FF6600]'
                            }`}
                          />
                        </div>
                      ),
                    )}
                  </div>

                  {/* Area Metrics & Downsampling Badge */}
                  <div className="flex items-center justify-between text-[8px] font-mono px-1 pt-0.5">
                    <span className={`flex items-center gap-1 ${isAreaExceeded ? 'text-red-400 font-bold' : 'text-[#8E95A5]'}`}>
                      <Maximize2 size={9} /> Area: {areaKm2} km² {isAreaExceeded && '(EXCEEDS 2,500 km² CAP)'}
                    </span>
                    <span className="text-[#FF6600] font-semibold">
                      Resolution: {resolutionInfo.res} ({resolutionInfo.badge})
                    </span>
                  </div>

                  {/* Safeguard Warning Banner if Area Exceeded */}
                  {isAreaExceeded && (
                    <div className="flex items-start gap-1.5 p-1.5 rounded border border-red-500/40 bg-red-500/10 text-red-400 font-mono text-[9px] leading-tight">
                      <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                      <span>
                        Selected area is too large for real-time scan ({areaKm2} km²). Please narrow your Area of Interest under 2,500 km² (~50 km × 50 km).
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ─── Observation Time Window: Date Range & Presets ─── */}
            <div className="flex flex-col gap-1 border-t border-white/5 pt-2">
              <div className="flex items-center justify-between">
                <label className="text-[9px] font-mono uppercase text-[#8E95A5] flex items-center gap-1">
                  <Calendar size={10} className="text-[#FF6600]" /> Observation Time Window:
                </label>

                {/* Presets: Latest, 3D, 7D, Custom */}
                <div className="flex items-center gap-1 font-mono text-[8px]">
                  {(['latest', '3d', '7d', 'custom'] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => {
                        if (p !== 'custom') {
                          handlePresetChange(p);
                        } else {
                          setTimePreset('custom');
                        }
                      }}
                      className={`px-1.5 py-0.5 rounded border uppercase transition-colors cursor-pointer ${
                        timePreset === p
                          ? 'border-[#FF6600] bg-[#FF6600]/20 text-[#FF6600] font-bold'
                          : 'border-transparent text-[#8E95A5] hover:text-white'
                      }`}
                    >
                      {p === 'latest' ? 'Latest Pass' : p === 'custom' ? 'Custom' : p.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Start & End Date Inputs with Auto 8-Day Window (DD-MM-YYYY) */}
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-[8px] font-mono text-[#8E95A5] uppercase font-bold px-0.5">
                    <span>Start (DD-MM-YYYY)</span>
                    <span className="text-[#FF6600]">T-0</span>
                  </div>
                  <div
                    className={`relative flex items-center justify-between border px-2 py-1 rounded transition-colors ${
                      isLight ? 'border-black/20 bg-white' : 'border-[#2D323E] bg-[#14161B]'
                    }`}
                  >
                    <input
                      type="text"
                      value={startDateDmy}
                      onChange={(e) => handleStartDateChange(e.target.value)}
                      placeholder="DD-MM-YYYY"
                      maxLength={10}
                      className={`w-full bg-transparent outline-none font-mono text-[10.5px] font-bold tracking-wide ${
                        isLight ? 'text-black' : 'text-white'
                      }`}
                    />
                    <div className="relative shrink-0 flex items-center justify-center w-5 h-5 ml-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          try {
                            startPickerRef.current?.showPicker();
                          } catch {
                            startPickerRef.current?.focus();
                          }
                        }}
                        className="text-[#6B7280] hover:text-[#FF6600] transition-colors cursor-pointer p-0.5"
                        title="Pick date from calendar"
                      >
                        <Calendar size={13} />
                      </button>
                      <input
                        ref={startPickerRef}
                        type="date"
                        value={startDate}
                        onChange={(e) => {
                          if (e.target.value) {
                            handleStartDateChange(e.target.value);
                          }
                        }}
                        style={{
                          position: 'absolute',
                          top: 0,
                          right: 0,
                          width: '20px',
                          height: '20px',
                          opacity: 0,
                          pointerEvents: 'none',
                        }}
                        tabIndex={-1}
                        aria-hidden="true"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-[8px] font-mono text-[#8E95A5] uppercase font-bold px-0.5">
                    <span>End (+8D Auto)</span>
                    <span className="text-emerald-400 font-bold">+8 Days</span>
                  </div>
                  <div
                    className={`relative flex items-center justify-between border px-2 py-1 rounded transition-colors ${
                      isLight ? 'border-black/20 bg-white' : 'border-[#2D323E] bg-[#14161B]'
                    }`}
                  >
                    <input
                      type="text"
                      value={endDateDmy}
                      onChange={(e) => handleEndDateChange(e.target.value)}
                      placeholder="DD-MM-YYYY"
                      maxLength={10}
                      className={`w-full bg-transparent outline-none font-mono text-[10.5px] font-bold tracking-wide ${
                        isLight ? 'text-black' : 'text-white'
                      }`}
                    />
                    <div className="relative shrink-0 flex items-center justify-center w-5 h-5 ml-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          try {
                            endPickerRef.current?.showPicker();
                          } catch {
                            endPickerRef.current?.focus();
                          }
                        }}
                        className="text-[#6B7280] hover:text-[#FF6600] transition-colors cursor-pointer p-0.5"
                        title="Pick date from calendar"
                      >
                        <Calendar size={13} />
                      </button>
                      <input
                        ref={endPickerRef}
                        type="date"
                        value={endDate}
                        onChange={(e) => {
                          if (e.target.value) {
                            handleEndDateChange(e.target.value);
                          }
                        }}
                        style={{
                          position: 'absolute',
                          top: 0,
                          right: 0,
                          width: '20px',
                          height: '20px',
                          opacity: 0,
                          pointerEvents: 'none',
                        }}
                        tabIndex={-1}
                        aria-hidden="true"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Auto 8-Day Active Tag or Clamping Notification */}
              {timePreset === 'custom' && startDate && endDate && (
                (() => {
                  const dStart = new Date(startDate);
                  const dEnd = new Date(endDate);
                  const diffDays = Math.round((dEnd.getTime() - dStart.getTime()) / (1000 * 3600 * 24));
                  if (diffDays > 14) {
                    return (
                      <div className="flex items-start gap-1 p-1.5 rounded border border-[#FF6600]/40 bg-[#FF6600]/10 text-[#FF6600] font-mono text-[8px] leading-tight">
                        <Clock size={10} className="shrink-0 mt-0.5" />
                        <span>
                          Wide range detected ({diffDays}d). Process API queries single scenes; search will automatically clamp to 8 days from start date to ensure target incident pass is captured.
                        </span>
                      </div>
                    );
                  }
                  return (
                    <div className="flex items-center justify-between text-[8px] font-mono text-[#8E95A5] px-0.5">
                      <span className="text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 size={9} /> Window: {diffDays} days (Auto-calculated)
                      </span>
                      <span className="text-[#FF6600]">Aligned with Sentinel-1 orbit</span>
                    </div>
                  );
                })()
              )}

              {/* Warning if date precedes Sentinel-1 constellation launch (Oct 2014) */}
              {timePreset !== 'latest' && startDate && startDate < '2014-10-01' && (
                <div className="flex items-start gap-1 p-1.5 rounded border border-amber-500/40 bg-amber-500/10 text-amber-300 font-mono text-[8px] leading-tight">
                  <AlertTriangle size={11} className="shrink-0 mt-0.5 text-amber-400" />
                  <span>
                    Sentinel-1 SAR was launched in 2014. Dates prior to Oct 2014 return empty (NaN) rasters from the Copernicus satellite archive.
                  </span>
                </div>
              )}
            </div>

            {/* ─── Sensor & Optical Cloud Cover Filter (Future-Proofing) ─── */}
            <div className="flex items-center justify-between gap-2 border-t border-white/5 pt-2 text-[9px] font-mono text-[#8E95A5]">
              <div className="flex items-center gap-1.5">
                <Layers size={10} className="text-[#FF6600]" />
                <select
                  value={sensor}
                  onChange={(e) => setSensor(e.target.value as any)}
                  className="bg-transparent border border-[#2D323E] text-white px-1.5 py-0.5 rounded outline-none cursor-pointer text-[9px]"
                >
                  <option value="Sentinel-1 SAR">Sentinel-1 SAR (Radar)</option>
                  <option value="Sentinel-2 MSI">Sentinel-2 MSI (Optical)</option>
                </select>
              </div>

              {sensor === 'Sentinel-2 MSI' && (
                <div className="flex items-center gap-1">
                  <Sliders size={9} />
                  <span>Cloud &lt; {cloudCover}%</span>
                  <input
                    type="range"
                    min="0"
                    max="50"
                    step="5"
                    value={cloudCover}
                    onChange={(e) => setCloudCover(Number(e.target.value))}
                    className="w-14 h-1 accent-[#FF6600] cursor-pointer"
                  />
                </div>
              )}
            </div>

            {/* ─── Multi-Slick Switcher Strip ─── */}
            {hasDetections && activeResult?.spills && activeResult.spills.length > 1 && (
              <div
                className={`flex items-center justify-between p-2 rounded border font-mono text-[9px] ${
                  isLight ? 'bg-orange-50/80 border-orange-200 text-orange-950' : 'bg-black/40 border-[#FF6600]/30 text-white'
                }`}
              >
                <div className="flex items-center gap-1 text-[8.5px] uppercase tracking-wide text-[#FF6600] font-bold">
                  <Droplets size={11} className="text-[#FF6600]" />
                  <span>Detected Slicks ({activeResult.spills.length}):</span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {activeResult.spills.map((s, idx) => {
                    const isSelected = (selectedSpillIdx === idx);
                    return (
                      <button
                        key={idx}
                        onClick={() => {
                          soundEngine.playBubbleHover();
                          onSelectSpillIdx?.(idx);
                        }}
                        className={`px-2 py-0.5 rounded text-[8.5px] font-bold transition-all cursor-pointer border ${
                          isSelected
                            ? 'bg-[#FF6600] text-black border-[#FF6600] shadow-[0_0_8px_rgba(255,102,0,0.4)] font-black'
                            : isLight
                            ? 'bg-white text-gray-700 border-black/15 hover:border-[#FF6600]/50'
                            : 'bg-white/5 text-gray-300 border-white/10 hover:border-[#FF6600]/50'
                        }`}
                        title={`Click to focus Slick #${idx + 1} (${s.area_km2.toFixed(2)} km²)`}
                      >
                        Slick #{idx + 1} ({s.area_km2.toFixed(1)} km²)
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ─── Status Strip ─── */}
            <div
              className={`flex items-center justify-between border px-2.5 py-1.5 text-[10px] font-mono rounded ${
                hasDetections
                  ? isLight
                    ? 'border-red-400 bg-red-100/95 text-red-900 font-bold shadow-sm'
                    : 'border-red-500/40 bg-red-500/15 text-red-400 font-bold'
                  : isClean
                  ? isLight
                    ? 'border-emerald-400 bg-emerald-100/95 text-emerald-900 font-bold shadow-sm'
                    : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400 font-bold'
                  : isLight
                  ? 'border-gray-300 bg-gray-100 text-gray-800'
                  : 'border-white/5 bg-white/[0.02] text-[#8E95A5]'
              }`}
            >
              <div className="flex items-center gap-1.5 truncate">
                <MapPin size={11} className="text-[#FF6600] shrink-0" />
                <span className="truncate font-semibold">
                  {mode === 'preset' ? selectedZone.label : 'Custom Target AOI'}
                </span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {scanningType ? (
                  <span className="flex items-center gap-1 text-[#FF6600] font-bold">
                    <Loader2 size={11} className="animate-spin" />
                    {scanningType === 'drill' ? 'INSPECTING DRILL...' : 'ESA SATELLITE SCAN...'}
                  </span>
                ) : hasDetections ? (
                  <span className={`flex items-center gap-1 font-bold ${isLight ? 'text-red-900' : 'text-red-400'}`}>
                    <AlertTriangle size={11} />
                    {activeResult.total_slicks_detected > 1
                      ? `SLICK #${selectedSpillIdx + 1} / ${activeResult.total_slicks_detected} (${((activeResult.spills[selectedSpillIdx] || activeResult.spills[0]).area_km2).toFixed(1)} km²)`
                      : `${activeResult.total_slicks_detected} SLICK (${activeResult.total_area_km2} km²)`}
                  </span>
                ) : isClean ? (
                  <span className={`flex items-center gap-1 font-bold ${isLight ? 'text-emerald-900' : 'text-emerald-400'}`}>
                    <CheckCircle2 size={11} />
                    ZONE CLEAN ({activeResult.pipeline_latency_seconds}s)
                  </span>
                ) : (
                  <span className={isLight ? 'text-gray-600' : 'text-[#6B7280]'}>Ready to inspect</span>
                )}
              </div>
            </div>

            {/* ─── Weather & Reverse-Drift (Leeway) Card ─── */}
            {slickWeather && (
              <div
                className={`border rounded p-2 flex flex-col gap-1.5 font-mono text-[9px] ${
                  isLight ? 'border-sky-300/80 bg-sky-50/70 text-sky-950' : 'border-sky-500/30 bg-sky-950/20 text-sky-200'
                }`}
              >
                <div className="flex items-center justify-between border-b pb-1 border-white/10">
                  <div className="flex items-center gap-1.5">
                    <Compass size={11} className="text-[#FF6600]" />
                    <span className="font-bold text-[9px] uppercase tracking-wider text-[#FF6600]">
                      Weather & Drift Conditions
                    </span>
                  </div>
                  <span className="text-[7.5px] px-1.5 py-0.5 rounded font-bold uppercase bg-sky-500/20 text-sky-300 border border-sky-500/30">
                    {slickWeather.cached ? 'LOCAL CACHED ARCHIVE' : 'OPEN-METEO VERIFIED'}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-1 text-center text-[8px]">
                  <div className={`p-1 rounded border flex flex-col items-center ${isLight ? 'bg-black/5 border-black/10' : 'bg-black/30 border-white/5'}`}>
                    <span className="text-[7px] text-[#8E95A5] uppercase">Wind (10m)</span>
                    <span className="font-bold text-sky-400">
                      {slickWeather.wind_speed_kmh} km/h
                    </span>
                    <span className="text-[6.5px] text-[#8E95A5]">Dir: {slickWeather.wind_direction_deg}°</span>
                  </div>
                  <div className={`p-1 rounded border flex flex-col items-center ${isLight ? 'bg-black/5 border-black/10' : 'bg-black/30 border-white/5'}`}>
                    <span className="text-[7px] text-[#8E95A5] uppercase">Surface Current</span>
                    <span className="font-bold text-teal-400">
                      {slickWeather.current_speed_kmh} km/h
                    </span>
                    <span className="text-[6.5px] text-[#8E95A5]">Dir: {slickWeather.current_direction_deg}°</span>
                  </div>
                  <div className={`p-1 rounded border flex flex-col items-center ${isLight ? 'bg-black/5 border-black/10' : 'bg-black/30 border-white/5'}`}>
                    <span className="text-[7px] text-[#8E95A5] uppercase">Sea State</span>
                    <span className="font-bold text-amber-400">
                      {slickWeather.wave_height_m}m wave
                    </span>
                    <span className="text-[6.5px] text-[#8E95A5]">{slickWeather.sea_temperature_c}°C</span>
                  </div>
                </div>

                {slickDrift && (
                  <div className="flex items-center justify-between pt-0.5 text-[8px] text-[#8E95A5]">
                    <span>Net Drift: <strong className={isLight ? 'text-black' : 'text-white'}>{slickDrift.combinedDriftSpeedKmh} km/h</strong> @ {slickDrift.combinedDriftDirectionDeg}°</span>
                    <span>Backtrack (6h): <strong className="text-[#FF6600]">{slickDrift.totalDriftDistanceKm} km</strong></span>
                  </div>
                )}
              </div>
            )}

            {/* ─── AIS Suspect Attribution Summary (Detailed in Right Suspect Dock) ─── */}
            {hasDetections && activeResult && (activeResult.max_suspect || activeResult.ground_truth_comparison?.has_ground_truth || (activeResult.suspects && activeResult.suspects.length > 0)) && (
              <div
                className={`border rounded p-2 flex items-center justify-between font-mono text-[9px] ${
                  isLight
                    ? 'border-orange-300/80 bg-orange-50/90 text-[#14161B]'
                    : 'border-[#FF6600]/40 bg-[#FF6600]/10 text-white'
                }`}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <Ship size={12} className="text-[#FF6600] shrink-0" />
                  <div className="truncate">
                    <span className="text-[#FF6600] font-bold uppercase">
                      {activeResult.max_suspect ? `Suspect: ${activeResult.max_suspect.name}` : 'Suspects Correlated'}
                    </span>
                    {activeResult.max_suspect && (
                      <span className={`text-[8px] ml-1 ${isLight ? 'text-gray-600' : 'text-[#8E95A5]'}`}>
                        ({activeResult.max_suspect.probability_pct.toFixed(0)}% match)
                      </span>
                    )}
                  </div>
                </div>
                <span className="text-[8px] px-1.5 py-0.5 rounded font-bold uppercase bg-[#FF6600] text-black shrink-0">
                  SHOWN IN RIGHT DOCK →
                </span>
              </div>
            )}

            {/* ─── Dual Actions: [ 🎯 SCAN LIVE SAR ] [ 🔥 ALERT DRILL (SPILL) ] ─── */}
            <div className="grid grid-cols-2 gap-2 pt-0.5">
              <button
                onClick={() => handleScan(false)}
                disabled={!!scanningType || (isAreaExceeded && mode === 'custom')}
                className={`flex items-center justify-center gap-1.5 border py-2 px-2 font-mono text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer rounded-sm disabled:opacity-40 disabled:cursor-not-allowed ${
                  isLight
                    ? 'border-orange-600 bg-orange-600 text-white hover:bg-orange-700 shadow-sm'
                    : 'border-[#FF6600]/40 bg-[#FF6600]/10 hover:bg-[#FF6600]/20 text-[#FF6600]'
                }`}
                title="Queries real live Sentinel-1 SAR imagery from Copernicus Process API"
              >
                {scanningType === 'live' ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Radar size={12} />
                )}
                🎯 SCAN LIVE SAR
              </button>

              <button
                onClick={() => handleScan(true)}
                disabled={!!scanningType}
                className={`flex items-center justify-center gap-1.5 border py-2 px-2 font-mono text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer rounded-sm disabled:opacity-40 disabled:cursor-not-allowed ${
                  isLight
                    ? 'border-red-600 bg-red-600 text-white hover:bg-red-700 shadow-sm'
                    : 'border-red-500/50 bg-red-500/15 hover:bg-red-500/25 text-red-400 shadow-[0_0_10px_rgba(239,68,68,0.15)]'
                }`}
                title="Runs simulated ground-truth oil spill incident drill with YOLOv8-Seg"
              >
                {scanningType === 'drill' ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Flame size={12} />
                )}
                🔥 ALERT DRILL (SPILL)
              </button>
            </div>

            {/* Link to Historical Spill Archive */}
            {onOpenHistory && (
              <div className="border-t border-white/5 pt-1.5 flex justify-center">
                <button
                  onClick={() => {
                    soundEngine.playBubbleHover();
                    onOpenHistory();
                  }}
                  className="flex items-center gap-1 text-[9px] font-mono text-[#8E95A5] hover:text-[#FF6600] transition-colors cursor-pointer"
                >
                  <Archive size={10} className="text-[#FF6600]" />
                  Browse 10 Recorded Spills in Incident Archive →
                </button>
              </div>
            )}

            {/* Error Banner */}
            {error && (
              <div className="border border-red-500/30 bg-red-500/10 p-1.5 font-mono text-[9px] text-red-400 rounded">
                {error}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

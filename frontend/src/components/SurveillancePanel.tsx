import { useState, useMemo } from 'react';
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
} from 'lucide-react';
import { soundEngine } from '../utils/soundEngine';
import type { SurveillanceScanResult, SurveillanceScanParams } from '../types';
import { triggerSurveillanceScan } from '../api/client';

export interface ZoneConfig {
  key: string;
  label: string;
  bbox: [number, number, number, number];
  description: string;
}

export const STRATEGIC_ZONES: ZoneConfig[] = [
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
}

export default function SurveillancePanel({
  isLight = false,
  onScanComplete,
  customBbox,
  onCustomBboxChange,
  isDrawingBox,
  onToggleDrawBox,
  onOpenHistory,
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
      past.setDate(now.getDate() - 30);
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

      const startIso = timePreset !== 'latest' ? `${startDate}T00:00:00Z` : undefined;
      const endIso = timePreset !== 'latest' ? `${endDate}T23:59:59Z` : undefined;

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
            className="flex flex-col gap-2.5 p-3 overflow-hidden"
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
                    setSelectedZoneKey(e.target.value);
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
              /* ─── Mode 2: CUSTOM BOUNDING BOX [W, S, E, N] with Map Draw Sync ─── */
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label
                    className={`text-[9px] font-mono uppercase flex items-center gap-1 ${
                      isLight ? 'text-[#1F2937] font-semibold' : 'text-[#8E95A5]'
                    }`}
                  >
                    <Crosshair size={10} className="text-[#FF6600]" /> Custom Bounding Box [W, S, E, N]:
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
            )}

            {/* ─── Observation Time Window: Date Range & Presets ─── */}
            <div className="flex flex-col gap-1 border-t border-white/5 pt-2">
              <div className="flex items-center justify-between">
                <label className="text-[9px] font-mono uppercase text-[#8E95A5] flex items-center gap-1">
                  <Calendar size={10} className="text-[#FF6600]" /> Observation Time Window:
                </label>

                {/* Presets: Latest, 3D, 7D, Custom */}
                <div className="flex items-center gap-1 font-mono text-[8px]">
                  {(['latest', '3d', '7d'] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => handlePresetChange(p)}
                      className={`px-1.5 py-0.5 rounded border uppercase transition-colors cursor-pointer ${
                        timePreset === p
                          ? 'border-[#FF6600] bg-[#FF6600]/20 text-[#FF6600] font-bold'
                          : 'border-transparent text-[#8E95A5] hover:text-white'
                      }`}
                    >
                      {p === 'latest' ? 'Latest Pass' : p.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Start & End Date Inputs */}
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-1 border px-1.5 py-1 rounded text-[10px] font-mono border-[#2D323E] bg-[#14161B]">
                  <span className="text-[8px] text-[#6B7280] uppercase">Start:</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      setTimePreset('custom');
                    }}
                    className="w-full bg-transparent text-white outline-none cursor-pointer text-[9px]"
                  />
                </div>
                <div className="flex items-center gap-1 border px-1.5 py-1 rounded text-[10px] font-mono border-[#2D323E] bg-[#14161B]">
                  <span className="text-[8px] text-[#6B7280] uppercase">End:</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => {
                      setEndDate(e.target.value);
                      setTimePreset('custom');
                    }}
                    className="w-full bg-transparent text-white outline-none cursor-pointer text-[9px]"
                  />
                </div>
              </div>
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
                    {activeResult.total_slicks_detected} SLICK ({activeResult.total_area_km2} km²)
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

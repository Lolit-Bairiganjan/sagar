import { useState } from 'react';
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
} from 'lucide-react';
import { soundEngine } from '../utils/soundEngine';
import type { SurveillanceScanResult } from '../types';
import { triggerSurveillanceScan } from '../api/client';

export interface ZoneConfig {
  key: string;
  label: string;
  bbox: [number, number, number, number];
  description: string;
}

export const INDIAN_OCEAN_ZONES: ZoneConfig[] = [
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
    key: 'paradip_port',
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

interface SurveillancePanelProps {
  isLight?: boolean;
  onScanComplete?: (result: SurveillanceScanResult) => void;
}

export default function SurveillancePanel({
  isLight = false,
  onScanComplete,
}: SurveillancePanelProps) {
  const [mode, setMode] = useState<'preset' | 'custom'>('preset');
  const [selectedZoneKey, setSelectedZoneKey] = useState<string>('mumbai_high');
  const [customBbox, setCustomBbox] = useState<[string, string, string, string]>([
    '71.25',
    '19.35',
    '71.55',
    '19.65',
  ]);
  const [scanningType, setScanningType] = useState<'live' | 'drill' | null>(null);
  const [results, setResults] = useState<Record<string, SurveillanceScanResult>>({});
  const [error, setError] = useState<string | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);

  const selectedZone =
    INDIAN_OCEAN_ZONES.find((z) => z.key === selectedZoneKey) || INDIAN_OCEAN_ZONES[0];
  const activeKey = mode === 'preset' ? selectedZoneKey : 'custom';
  const activeResult = results[activeKey];

  const handleScan = async (isDrill: boolean = false) => {
    if (scanningType) return;
    soundEngine.playBubbleHover();
    setScanningType(isDrill ? 'drill' : 'live');
    setError(null);

    try {
      let payload: { zone?: string; bbox?: [number, number, number, number]; drill: boolean };
      if (mode === 'preset') {
        payload = { zone: selectedZone.key, drill: isDrill };
      } else {
        const nums = customBbox.map((v) => parseFloat(v));
        if (nums.some(isNaN)) {
          throw new Error('Please enter valid numeric coordinates for [minLon, minLat, maxLon, maxLat]');
        }
        const minLon = Math.min(nums[0], nums[2]);
        const maxLon = Math.max(nums[0], nums[2]);
        const minLat = Math.min(nums[1], nums[3]);
        const maxLat = Math.max(nums[1], nums[3]);

        if (minLon === maxLon || minLat === maxLat) {
          throw new Error('Bounding box must have a non-zero width and height');
        }
        if (maxLon - minLon > 2.0 || maxLat - minLat > 2.0) {
          throw new Error(
            `AOI span too large (${(maxLon - minLon).toFixed(1)}° × ${(maxLat - minLat).toFixed(1)}°). Sentinel-1 SAR requires an area under 2.0° (approx 200 km).`
          );
        }

        payload = {
          bbox: [minLon, minLat, maxLon, maxLat],
          drill: isDrill,
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
      style={{ width: isMinimized ? 290 : 410 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/5 select-none">
        <div className="flex items-center gap-2">
          <Radar size={13} className="text-[#FF6600] animate-pulse" />
          <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#FF6600]">
            Live Surveillance
          </span>
          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#FF6600]/10 text-[#FF6600] border border-[#FF6600]/30">
            Sentinel-1 SAR
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
                onClick={() => setMode('preset')}
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
                11 Zones
              </button>
              <button
                onClick={() => setMode('custom')}
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
            className="flex flex-col gap-2 p-3 overflow-hidden"
          >
            {/* Mode 1: Strategic Indian Ocean Zones Selector */}
            {mode === 'preset' ? (
              <div className="flex flex-col gap-1">
                <label className="text-[9px] font-mono uppercase text-[#8E95A5] flex items-center gap-1">
                  <Globe size={10} className="text-[#FF6600]" /> Indian Ocean Strategic Zones:
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
                <div className={`flex items-center justify-between text-[9px] font-mono px-1 ${
                  isLight ? 'text-[#1F2937] font-medium' : 'text-[#8E95A5]'
                }`}>
                  <span className="truncate">{selectedZone.description}</span>
                  <span className={`shrink-0 ${isLight ? 'text-gray-500' : 'text-[#4B5262]'}`}>
                    [{selectedZone.bbox.join(', ')}]
                  </span>
                </div>
              </div>
            ) : (
              /* Mode 2: Custom Bounding Box Inputs */
              <div className="flex flex-col gap-1">
                <label className={`text-[9px] font-mono uppercase flex items-center gap-1 ${
                  isLight ? 'text-[#1F2937] font-semibold' : 'text-[#8E95A5]'
                }`}>
                  <Crosshair size={10} className="text-[#FF6600]" /> Custom Bounding Box [W, S, E, N]:
                </label>
                <div className="grid grid-cols-4 gap-1">
                  {(['Min Lon', 'Min Lat', 'Max Lon', 'Max Lat'] as const).map((label, i) => (
                    <div key={label} className="flex flex-col gap-0.5">
                      <span className={`text-[8px] font-mono ${isLight ? 'text-gray-600' : 'text-[#6B7280]'}`}>{label}</span>
                      <input
                        type="text"
                        value={customBbox[i]}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCustomBbox((prev) => {
                            const next = [...prev] as [string, string, string, string];
                            next[i] = val;
                            return next;
                          });
                        }}
                        className={`border px-1.5 py-1 text-[10px] font-mono text-center rounded outline-none ${
                          isLight
                            ? 'bg-white border-black/30 text-[#14161B] font-semibold'
                            : 'bg-[#181B22] border-[#2D323E] text-white focus:border-[#FF6600]'
                        }`}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Status Strip */}
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

            {/* Dual Actions: Live Copernicus Scan + Emergency Alert Drill */}
            <div className="grid grid-cols-2 gap-2 pt-0.5">
              <button
                onClick={() => handleScan(false)}
                disabled={!!scanningType}
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
                Scan Live SAR
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
                Alert Drill (Spill)
              </button>
            </div>

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

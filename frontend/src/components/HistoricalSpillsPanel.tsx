import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Droplets,
  Calendar,
  Compass,
  Wind,
  Search,
  ChevronDown,
  ChevronUp,
  Loader2,
  ArrowRight,
} from 'lucide-react';
import { soundEngine } from '../utils/soundEngine';
import type { HistoricalSpillSummary, HistoricalSpillDetail } from '../types';
import { getHistoricalSpills, getHistoricalSpillDetail, getHistoricalWeather } from '../api/client';
import { calculateReverseDrift } from '../utils/driftEngine';
import { formatIndianDateTime } from '../utils/time';

interface HistoricalSpillsPanelProps {
  isLight?: boolean;
  selectedSpillId?: number | null;
  onSelectSpill?: (detail: HistoricalSpillDetail) => void;
  onClose?: () => void;
}

export default function HistoricalSpillsPanel({
  isLight = false,
  selectedSpillId = null,
  onSelectSpill,
  onClose,
}: HistoricalSpillsPanelProps) {
  const [spills, setSpills] = useState<HistoricalSpillSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'area'>('date');
  const [inspectingId, setInspectingId] = useState<number | null>(selectedSpillId);
  const [loadingDetailId, setLoadingDetailId] = useState<number | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function fetchHistory() {
      setLoading(true);
      setError(null);
      try {
        const data = await getHistoricalSpills(50);
        if (!cancelled) {
          setSpills(data.spills);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || 'Failed to load historical spill records');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchHistory();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleInspect = async (spillId: number) => {
    soundEngine.playBubbleHover();
    setInspectingId(spillId);
    setLoadingDetailId(spillId);
    try {
      const targetSpill = spills.find((s) => s.id === spillId);
      let originLat: number | undefined;
      let originLon: number | undefined;

      if (targetSpill && targetSpill.centroid_lat && targetSpill.centroid_lon) {
        try {
          const obsDate = targetSpill.detected_at ? targetSpill.detected_at.slice(0, 10) : undefined;
          const weather = await getHistoricalWeather(targetSpill.centroid_lat, targetSpill.centroid_lon, obsDate);
          const drift = calculateReverseDrift({
            centroid: { lat: targetSpill.centroid_lat, lng: targetSpill.centroid_lon },
            observedAtUtc: targetSpill.detected_at || new Date().toISOString(),
            windSpeedKmh: weather.wind_speed_kmh,
            windDirectionDeg: weather.wind_direction_deg,
            currentSpeedKmh: weather.current_speed_kmh,
            currentDirectionDeg: weather.current_direction_deg,
            driftHours: targetSpill.drift_hours_assumed || 6,
          });
          originLat = drift.origin.lat;
          originLon = drift.origin.lng;
        } catch (err) {
          console.warn('Frontend drift calculation fallback:', err);
        }
      }

      const detail = await getHistoricalSpillDetail(spillId, originLat, originLon);
      onSelectSpill?.(detail);
    } catch (err: any) {
      setError(err?.message || `Failed to fetch spill #${spillId} details`);
    } finally {
      setLoadingDetailId(null);
    }
  };

  const filteredSpills = useMemo(() => {
    let list = [...spills];
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(
        (s) =>
          s.id.toString().includes(q) ||
          s.area_km2.toString().includes(q) ||
          s.detected_at.toLowerCase().includes(q),
      );
    }
    list.sort((a, b) => {
      if (sortBy === 'area') {
        return b.area_km2 - a.area_km2;
      }
      return new Date(b.detected_at).getTime() - new Date(a.detected_at).getTime();
    });
    return list;
  }, [spills, searchTerm, sortBy]);

  return (
    <div
      className={`pointer-events-auto flex flex-col border shadow-xl backdrop-blur-md transition-all duration-200 ${
        isLight
          ? 'bg-white/95 border-black/15 text-[#14161B]'
          : 'bg-[#10131A]/95 border-[#2D323E] text-white'
      }`}
      style={{ width: isMinimized ? 300 : 420, maxHeight: '80vh' }}
    >
      {/* Panel Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/5 select-none">
        <div className="flex items-center gap-2">
          <Droplets size={14} className="text-[#FF6600]" />
          <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-[#FF6600]">
            Incident Archive
          </span>
          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#FF6600]/10 text-[#FF6600] border border-[#FF6600]/30 font-bold">
            {spills.length} SPILLS
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setIsMinimized((m) => !m)}
            className="text-[#8E95A5] hover:text-white transition-colors cursor-pointer p-0.5"
            title={isMinimized ? 'Expand archive' : 'Minimize archive'}
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
            {/* Search & Sort Controls */}
            <div className="flex items-center gap-2">
              <div
                className={`flex-1 flex items-center gap-1.5 border px-2 py-1 rounded text-[11px] font-mono ${
                  isLight
                    ? 'bg-white border-black/20 text-[#14161B]'
                    : 'bg-[#181B22] border-[#2D323E] text-white'
                }`}
              >
                <Search size={11} className="text-[#8E95A5]" />
                <input
                  type="text"
                  placeholder="Search by ID or area..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-transparent outline-none placeholder:text-[#6B7280] text-[10px]"
                />
              </div>

              <div
                className={`flex items-center rounded p-0.5 text-[9px] font-mono border shrink-0 ${
                  isLight ? 'bg-black/5 border-black/15' : 'bg-black/40 border-white/10'
                }`}
              >
                <button
                  onClick={() => setSortBy('date')}
                  className={`px-2 py-0.5 rounded-sm transition-colors cursor-pointer ${
                    sortBy === 'date'
                      ? 'bg-[#FF6600] text-white font-bold'
                      : 'text-[#8E95A5] hover:text-white'
                  }`}
                >
                  Latest
                </button>
                <button
                  onClick={() => setSortBy('area')}
                  className={`px-2 py-0.5 rounded-sm transition-colors cursor-pointer ${
                    sortBy === 'area'
                      ? 'bg-[#FF6600] text-white font-bold'
                      : 'text-[#8E95A5] hover:text-white'
                  }`}
                >
                  Area
                </button>
              </div>
            </div>

            {/* Spill Cards List */}
            {loading ? (
              <div className="flex items-center justify-center py-8 gap-2 font-mono text-[11px] text-[#FF6600]">
                <Loader2 size={14} className="animate-spin" />
                Loading incident records from Supabase...
              </div>
            ) : filteredSpills.length === 0 ? (
              <div className="text-center py-6 font-mono text-[10px] text-[#8E95A5]">
                No recorded spills match your query.
              </div>
            ) : (
              <div className="flex flex-col gap-1.5 overflow-y-auto max-h-[50vh] pr-1">
                {filteredSpills.map((s) => {
                  const isSelected = inspectingId === s.id;
                  const isLoadingThis = loadingDetailId === s.id;
                  const isLarge = s.area_km2 >= 50;
                  const isMedium = s.area_km2 >= 15;

                  return (
                    <motion.div
                      key={s.id}
                      whileHover={{ scale: 1.01 }}
                      onClick={() => handleInspect(s.id)}
                      className={`border p-2.5 transition-all cursor-pointer rounded-sm ${
                        isSelected
                          ? 'border-[#FF6600] bg-[#FF6600]/10 shadow-[0_0_12px_rgba(255,102,0,0.15)]'
                          : isLight
                          ? 'border-black/10 bg-white/60 hover:border-[#FF6600]/40'
                          : 'border-[#2D323E] bg-[#14161B]/60 hover:border-[#FF6600]/40'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-mono text-[10px] font-bold px-1.5 py-0.2 border rounded ${
                              isSelected
                                ? 'bg-[#FF6600] text-black border-[#FF6600]'
                                : 'bg-[#FF6600]/10 text-[#FF6600] border-[#FF6600]/30'
                            }`}
                          >
                            SPILL #{s.id}
                          </span>
                          <span
                            className={`font-mono text-[10px] font-bold ${
                              isLarge
                                ? 'text-red-400'
                                : isMedium
                                ? 'text-amber-400'
                                : 'text-emerald-400'
                            }`}
                          >
                            {s.area_km2} km²
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {isLoadingThis ? (
                            <Loader2 size={12} className="animate-spin text-[#FF6600]" />
                          ) : isSelected ? (
                            <span className="font-mono text-[8px] font-bold uppercase tracking-wider text-[#FF6600] flex items-center gap-0.5">
                              Active <ArrowRight size={10} />
                            </span>
                          ) : (
                            <span className="font-mono text-[8px] text-[#8E95A5] hover:text-[#FF6600]">
                              Inspect
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Timestamp & Location */}
                      <div className="mt-1.5 flex items-center justify-between text-[9px] font-mono text-[#8E95A5]">
                        <span className="flex items-center gap-1 truncate">
                          <Calendar size={10} className="text-[#FF6600] shrink-0" />
                          {formatIndianDateTime(s.detected_at)}
                        </span>
                        <span className="shrink-0">
                          {s.centroid_lat.toFixed(2)}°N, {s.centroid_lon.toFixed(2)}°E
                        </span>
                      </div>

                      {/* Drift & Oceanographic telemetry */}
                      <div className="mt-1 flex items-center gap-3 text-[8px] font-mono text-[#6B7280]">
                        {s.has_drift_estimate ? (
                          <>
                            <span className="flex items-center gap-0.5">
                              <Compass size={9} className="text-[#FF6600]" />
                              Drift: {s.total_drift_distance_km ?? 0} km @ {s.combined_drift_direction_deg ?? 0}°
                            </span>
                            {s.wind_speed_kmh != null && (
                              <span className="flex items-center gap-0.5">
                                <Wind size={9} />
                                {s.wind_speed_kmh} km/h
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-amber-400/80">Drift backtrack pending</span>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}

            {/* Error Message */}
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

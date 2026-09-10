import { motion } from 'framer-motion';
import {
  ShipWheel,
  MapPin,
  Clock,
  Route,
  AlertTriangle,
  CheckCircle2,
  Ship,
  Radio,
} from 'lucide-react';
import type { RiskLevel, Vessel, SurveillanceScanResult } from '../types';
import { soundEngine } from '../utils/soundEngine';

const RISK_STYLES: Record<RiskLevel, { text: string; bg: string; border: string }> = {
  CRITICAL: { text: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/40' },
  HIGH: { text: 'text-[#FF6600]', bg: 'bg-[#FF6600]/10', border: 'border-[#FF6600]/40' },
  MEDIUM: { text: 'text-amber-400', bg: 'bg-amber-400/10', border: 'border-amber-400/40' },
  LOW: { text: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/40' },
};

interface SidebarProps {
  vessels: Vessel[];
  selectedVesselId: string | null;
  onSelectVessel: (id: string) => void;
  isLight?: boolean;
  surveillanceResult?: SurveillanceScanResult | null;
}

export default function Sidebar({
  vessels,
  selectedVesselId,
  onSelectVessel,
  isLight = false,
  surveillanceResult,
}: SidebarProps) {
  // Check if surveillance result has suspect data
  const hasSurveillanceSuspects = Boolean(
    surveillanceResult &&
      (surveillanceResult.max_suspect ||
        (surveillanceResult.suspects && surveillanceResult.suspects.length > 0) ||
        surveillanceResult.ground_truth_comparison?.has_ground_truth)
  );

  const gt = surveillanceResult?.ground_truth_comparison;
  const maxSuspect = surveillanceResult?.max_suspect;
  const runnerUps =
    surveillanceResult?.suspects && surveillanceResult.suspects.length > 1
      ? surveillanceResult.suspects.slice(1)
      : [];

  return (
    <div
      className={`flex h-full flex-col transition-colors select-none ${
        isLight ? 'bg-[#EDEFF4] text-[#14161B]' : 'bg-[#181B22] text-white'
      }`}
    >
      {/* Dock Header */}
      <div
        className={`flex items-center gap-2 border-b px-4 py-3 ${
          isLight ? 'border-black/10 bg-white' : 'border-[#252932] bg-[#14161B]'
        }`}
      >
        <ShipWheel size={15} className="text-[#FF6600]" />
        <span className="font-mono text-xs font-bold uppercase tracking-widest text-inherit">
          Suspect Attribution
        </span>

        {gt?.has_ground_truth ? (
          <span className="ml-auto border border-purple-500/40 bg-purple-500/15 px-2 py-0.5 font-mono text-[10px] font-bold text-purple-400">
            BENCHMARK MATCH
          </span>
        ) : hasSurveillanceSuspects ? (
          <span className="ml-auto border border-[#FF6600]/30 bg-[#FF6600]/10 px-2 py-0.5 font-mono text-[10px] font-bold text-[#FF6600]">
            {(surveillanceResult?.suspects?.length || (maxSuspect ? 1 : 0))} CORRELATED
          </span>
        ) : (
          <span className="ml-auto border border-[#FF6600]/30 bg-[#FF6600]/10 px-2 py-0.5 font-mono text-[10px] font-bold text-[#FF6600]">
            0 TRACKED
          </span>
        )}
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {/* ─── CASE A: REAL SURVEILLANCE SCAN SUSPECT ATTRIBUTION ─── */}
        {hasSurveillanceSuspects && (
          <>
            {/* Ground-Truth Verification Banner */}
            {gt?.has_ground_truth && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className={`border p-2.5 rounded flex flex-col gap-1.5 font-mono ${
                  gt.is_match
                    ? isLight
                      ? 'border-emerald-500/60 bg-emerald-50 text-emerald-950'
                      : 'border-emerald-500/40 bg-emerald-950/40 text-emerald-300'
                    : isLight
                    ? 'border-amber-400 bg-amber-50 text-amber-950'
                    : 'border-amber-500/40 bg-amber-950/30 text-amber-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 size={12} className="text-emerald-400 shrink-0" />
                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">
                      ★ Ground Truth Verified
                    </span>
                  </div>
                  <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    MATCH: {gt.attribution_confidence_pct}%
                  </span>
                </div>

                <div className="text-[9px] leading-tight flex flex-col gap-0.5">
                  <div className={`font-bold ${isLight ? 'text-black' : 'text-white'}`}>
                    {gt.incident_name}
                  </div>
                  <div className="text-[8.5px] text-[#8E95A5]">
                    Actual Perpetrator:{' '}
                    <strong className="text-emerald-400">{gt.actual_suspect_name}</strong> (MMSI: {gt.actual_mmsi}) • {gt.actual_type}
                  </div>
                  <div className="text-[8px] opacity-90 mt-1 p-1.5 rounded bg-black/30 border border-white/5 italic leading-relaxed">
                    {gt.comparison_summary}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Top-Ranked Suspect Vessel Card */}
            {maxSuspect && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col gap-1"
              >
                <div className="flex items-center justify-between px-1">
                  <span className="text-[9px] font-mono font-bold uppercase text-[#FF6600] flex items-center gap-1">
                    <Ship size={11} /> Top Probable Source:
                  </span>
                  <span className="text-[10px] font-mono font-bold text-[#FF6600]">RANK #01</span>
                </div>

                <button
                  onClick={() => onSelectVessel(`v-${maxSuspect.mmsi}`)}
                  onMouseEnter={() => soundEngine.playBubbleHover()}
                  className={`w-full border p-3 text-left transition-all cursor-pointer rounded ${
                    selectedVesselId === `v-${maxSuspect.mmsi}` || selectedVesselId === String(maxSuspect.mmsi)
                      ? 'border-[#FF6600] bg-[#FF6600]/15 shadow-[0_0_15px_rgba(255,102,0,0.2)]'
                      : isLight
                      ? 'bg-white border-black/15 hover:border-[#FF6600]/70 hover:shadow-sm'
                      : 'bg-[#14161B] border-[#FF6600]/40 hover:border-[#FF6600]'
                  }`}
                >
                  <div className="mb-2 flex items-center gap-2">
                    <span className="font-mono text-2xl font-black leading-none text-[#FF6600]">
                      01
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-mono text-sm font-bold text-inherit">
                        {maxSuspect.name}
                      </div>
                      <div className="font-mono text-[11px] text-[#6B7280]">
                        MMSI {maxSuspect.mmsi} • {maxSuspect.vessel_type || 'Bulk Carrier / Tanker'}
                      </div>
                    </div>
                    <span className="shrink-0 border px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-red-400 bg-red-500/10 border-red-500/40">
                      CRITICAL RISK
                    </span>
                  </div>

                  {/* Probability Gauge */}
                  <div className="mb-2 flex items-baseline gap-1.5">
                    <span className="font-mono text-2xl font-black tabular-nums text-[#FF6600]">
                      {maxSuspect.probability_pct.toFixed(1)}%
                    </span>
                    <span className="font-mono text-[11px] text-[#6B7280]">
                      attribution match probability
                    </span>
                  </div>

                  {/* Proximity & Time */}
                  <div className="grid grid-cols-2 gap-x-2 gap-y-1 font-mono text-[10.5px] text-[#8E95A5] mb-2.5">
                    <span className="flex items-center gap-1">
                      <MapPin size={11} className="text-[#FF6600]" /> {maxSuspect.distance_km.toFixed(2)} km
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={11} className="text-[#FF6600]" /> {maxSuspect.hours_before.toFixed(1)}h before
                    </span>
                  </div>

                  {/* 5-Factor PostGIS Multi-Criteria Breakdown */}
                  {maxSuspect.factors && (
                    <div className="flex flex-col gap-1.5 border-t border-white/10 pt-2 font-mono">
                      <span className="text-[10px] uppercase tracking-wider font-bold text-[#8E95A5]">
                        Multi-Factor Attribution Scores (PostGIS):
                      </span>
                      <div className="grid grid-cols-5 gap-1 text-center">
                        <div className={`p-1.5 rounded border flex flex-col items-center ${isLight ? 'bg-black/5 border-black/10' : 'bg-black/30 border-white/5'}`}>
                          <span className="text-[9px] font-bold text-[#8E95A5] uppercase">Proxim.</span>
                          <span className="text-[12px] font-black text-emerald-400">
                            {maxSuspect.factors.proximity_score.toFixed(0)}%
                          </span>
                          <span className="text-[8px] text-[#6B7280]">w: 35%</span>
                        </div>
                        <div className={`p-1.5 rounded border flex flex-col items-center ${isLight ? 'bg-black/5 border-black/10' : 'bg-black/30 border-white/5'}`}>
                          <span className="text-[9px] font-bold text-[#8E95A5] uppercase">Time</span>
                          <span className="text-[12px] font-black text-emerald-400">
                            {maxSuspect.factors.time_score.toFixed(0)}%
                          </span>
                          <span className="text-[8px] text-[#6B7280]">w: 35%</span>
                        </div>
                        <div className={`p-1.5 rounded border flex flex-col items-center ${isLight ? 'bg-black/5 border-black/10' : 'bg-black/30 border-white/5'}`}>
                          <span className="text-[9px] font-bold text-[#8E95A5] uppercase">AIS Gap</span>
                          <span className={`text-[12px] font-black ${maxSuspect.factors.gap_score > 50 ? 'text-red-400' : 'text-gray-400'}`}>
                            {maxSuspect.factors.gap_score.toFixed(0)}%
                          </span>
                          <span className="text-[8px] text-[#6B7280]">w: 20%</span>
                        </div>
                        <div className={`p-1.5 rounded border flex flex-col items-center ${isLight ? 'bg-black/5 border-black/10' : 'bg-black/30 border-white/5'}`}>
                          <span className="text-[9px] font-bold text-[#8E95A5] uppercase">Type</span>
                          <span className="text-[12px] font-black text-amber-400">
                            {maxSuspect.factors.type_score.toFixed(0)}%
                          </span>
                          <span className="text-[8px] text-[#6B7280]">w: 15%</span>
                        </div>
                        <div className={`p-1.5 rounded border flex flex-col items-center ${isLight ? 'bg-black/5 border-black/10' : 'bg-black/30 border-white/5'}`}>
                          <span className="text-[9px] font-bold text-[#8E95A5] uppercase">Speed</span>
                          <span className={`text-[12px] font-black ${maxSuspect.factors.speed_anomaly_score > 50 ? 'text-red-400' : 'text-gray-400'}`}>
                            {maxSuspect.factors.speed_anomaly_score.toFixed(0)}%
                          </span>
                          <span className="text-[8px] text-[#6B7280]">w: 15%</span>
                        </div>
                      </div>
                    </div>
                  )}
                </button>
              </motion.div>
            )}

            {/* Runner-Up Correlated Candidates List */}
            {runnerUps.length > 0 && (
              <div className="space-y-2 pt-1 font-mono">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[9px] font-bold uppercase text-[#8E95A5]">
                    Runner-Up Correlated Vessels ({runnerUps.length}):
                  </span>
                </div>

                {runnerUps.map((cand, idx) => {
                  const rankNum = idx + 2;
                  const isSelected = selectedVesselId === `v-${cand.mmsi}` || selectedVesselId === String(cand.mmsi);
                  const scorePct = cand.final_score > 1 ? cand.final_score : cand.final_score * 100;

                  return (
                    <motion.div
                      key={cand.mmsi}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                    >
                      <button
                        onClick={() => onSelectVessel(`v-${cand.mmsi}`)}
                        onMouseEnter={() => soundEngine.playBubbleHover()}
                        className={`w-full border p-2.5 text-left transition-all cursor-pointer rounded ${
                          isSelected
                            ? 'border-[#FF6600] bg-[#FF6600]/10 shadow-[0_0_10px_rgba(255,102,0,0.15)]'
                            : isLight
                            ? 'bg-white border-black/10 hover:border-[#FF6600]/50 hover:shadow-sm'
                            : 'bg-[#14161B] border-[#252932] hover:border-[#FF6600]/40'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="font-mono text-[15px] font-black text-[#FF6600]">
                              {String(rankNum).padStart(2, '0')}
                            </span>
                            <span className="font-bold text-[11.5px] truncate text-inherit">
                              {cand.name || `MMSI ${cand.mmsi}`}
                            </span>
                          </div>
                          <span className="font-bold text-amber-400 text-[10px] shrink-0">
                            {scorePct.toFixed(1)}%
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[9px] text-[#8E95A5]">
                          <span>MMSI: {cand.mmsi}</span>
                          <span>{cand.distance_km.toFixed(1)} km</span>
                          <span>{cand.hours_before_detection.toFixed(1)}h</span>
                        </div>

                        {cand.flags && cand.flags.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {cand.flags.map((flg, fi) => (
                              <span
                                key={fi}
                                className="text-[7.5px] px-1 py-0.5 rounded border border-white/10 bg-white/5 text-[#8E95A5]"
                              >
                                {flg}
                              </span>
                            ))}
                          </div>
                        )}
                      </button>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ─── CASE B: AWAITING SCAN INITIAL STATE (WHEN NO SCAN PERFORMED YET) ─── */}
        {!hasSurveillanceSuspects && (
          <div
            className={`border p-4 rounded text-center flex flex-col items-center gap-2 font-mono ${
              isLight ? 'border-black/10 bg-white/60 text-gray-700' : 'border-[#252932] bg-[#14161B]/60 text-[#8E95A5]'
            }`}
          >
            <Radio size={24} className="text-[#FF6600] animate-pulse" />
            <div className="text-xs font-bold uppercase text-inherit">Awaiting Satellite Scan</div>
            <div className="text-[10px] leading-relaxed">
              Trigger a live Copernicus SAR scan or run an incident drill (e.g. MV Wakashio) to correlate AIS vessel traffic and pinpoint the spill source.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

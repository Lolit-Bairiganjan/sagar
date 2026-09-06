import { motion } from 'framer-motion';
import { ShipWheel, MapPin, Clock, Route, AlertTriangle } from 'lucide-react';
import type { RiskLevel, Vessel } from '../types';
import { soundEngine } from '../utils/soundEngine';

const RISK_STYLES: Record<RiskLevel, { text: string; bg: string; border: string }> = {
  CRITICAL: { text: 'text-accent-red', bg: 'bg-accent-red/10', border: 'border-accent-red/40' },
  HIGH: { text: 'text-[#FF6600]', bg: 'bg-[#FF6600]/10', border: 'border-[#FF6600]/40' },
  MEDIUM: { text: 'text-accent-amber', bg: 'bg-accent-amber/10', border: 'border-accent-amber/40' },
  LOW: { text: 'text-accent-green', bg: 'bg-accent-green/10', border: 'border-accent-green/40' },
};

interface SidebarProps {
  vessels: Vessel[];
  selectedVesselId: string | null;
  onSelectVessel: (id: string) => void;
  isLight?: boolean;
}

export default function Sidebar({ vessels, selectedVesselId, onSelectVessel, isLight = false }: SidebarProps) {
  const suspects = vessels
    .filter((v) => v.isSuspect && v.attribution)
    .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));

  return (
    <div
      className={`flex h-full flex-col transition-colors ${
        isLight ? 'bg-[#EDEFF4] text-[#14161B]' : 'bg-[#181B22] text-white'
      }`}
    >
      <div
        className={`flex items-center gap-2 border-b px-4 py-3 ${
          isLight ? 'border-black/10 bg-white' : 'border-[#252932] bg-[#14161B]'
        }`}
      >
        <ShipWheel size={15} className="text-[#FF6600]" />
        <span className="font-mono text-xs font-bold uppercase tracking-widest text-inherit">
          Suspect Vessels
        </span>
        <span className="ml-auto border border-[#FF6600]/30 bg-[#FF6600]/10 px-2 py-0.5 font-mono text-[11px] font-bold text-[#FF6600]">
          {suspects.length} TRACKED
        </span>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {suspects.map((vessel, i) => {
          const attr = vessel.attribution!;
          const risk = RISK_STYLES[attr.risk];
          const isSelected = vessel.id === selectedVesselId;

          return (
            <motion.div
              key={vessel.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04, duration: 0.3 }}
            >
              <button
                onClick={() => onSelectVessel(vessel.id)}
                onMouseEnter={() => soundEngine.playBubbleHover()}
                className={`w-full border p-3 text-left transition-all cursor-pointer ${
                  isSelected
                    ? 'border-[#FF6600] bg-[#FF6600]/10 shadow-[0_0_15px_rgba(255,102,0,0.15)]'
                    : isLight
                    ? 'bg-white border-black/10 hover:border-[#FF6600]/60 hover:shadow-sm'
                    : 'bg-[#14161B] border-[#252932] hover:border-[#FF6600]/50'
                }`}
              >
                <div className="mb-2 flex items-center gap-2">
                  <span className="font-mono text-lg font-black leading-none text-[#6B7280]">
                    {String(vessel.rank).padStart(2, '0')}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-mono text-xs font-bold text-inherit">
                      {vessel.name}
                    </div>
                    <div className="font-mono text-[11px] text-[#6B7280]">IMO {vessel.imo}</div>
                  </div>
                  <span
                    className={`shrink-0 border px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider ${risk.text} ${risk.bg} ${risk.border}`}
                  >
                    {attr.risk}
                  </span>
                </div>

                <div className="mb-2.5 flex items-baseline gap-1.5">
                  <span className="font-mono text-2xl font-black tabular-nums text-[#FF6600]">
                    {attr.attributionScorePct.toFixed(1)}%
                  </span>
                  <span className="font-mono text-[11px] text-[#6B7280]">attribution match</span>
                </div>

                <div className="grid grid-cols-2 gap-x-2 gap-y-1 font-mono text-[11px] text-[#8E95A5]">
                  <span className="flex items-center gap-1">
                    <MapPin size={11} className="text-[#6B7280]" /> {attr.distanceNm} NM
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock size={11} className="text-[#6B7280]" /> +{attr.timeDifferenceMinutes}m
                  </span>
                  <span className="flex items-center gap-1">
                    <Route size={11} className="text-[#6B7280]" /> {attr.trajectoryMatchPct}% match
                  </span>
                  <span className="flex items-center gap-1">
                    <AlertTriangle size={11} className="text-[#6B7280]" /> {attr.behaviorAnomaly}
                  </span>
                </div>
              </button>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

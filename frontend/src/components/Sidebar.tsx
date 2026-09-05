import { motion } from 'framer-motion';
import { ShipWheel, MapPin, Clock, Route, AlertTriangle } from 'lucide-react';
import type { RiskLevel, Vessel } from '../types';
import Tilt3D from './Tilt3D';

const RISK_STYLES: Record<RiskLevel, { text: string; bg: string; border: string }> = {
  CRITICAL: { text: 'text-accent-red', bg: 'bg-accent-red/10', border: 'border-accent-red/40' },
  HIGH: { text: 'text-accent-orange', bg: 'bg-accent-orange/10', border: 'border-accent-orange/40' },
  MEDIUM: { text: 'text-accent-amber', bg: 'bg-accent-amber/10', border: 'border-accent-amber/40' },
  LOW: { text: 'text-accent-green', bg: 'bg-accent-green/10', border: 'border-accent-green/40' },
};

interface SidebarProps {
  vessels: Vessel[];
  selectedVesselId: string | null;
  onSelectVessel: (id: string) => void;
}

export default function Sidebar({ vessels, selectedVesselId, onSelectVessel }: SidebarProps) {
  const suspects = vessels
    .filter((v) => v.isSuspect && v.attribution)
    .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));

  return (
    <div className="glass-strong flex h-full flex-col border-y-0 border-r-0">
      <div className="flex items-center gap-2 border-b border-white/5 px-4 py-3">
        <ShipWheel size={14} className="text-accent-cyan" />
        <span className="font-mono-tech text-xs font-semibold uppercase tracking-widest text-text-primary">
          Suspect Vessels
        </span>
        <span className="ml-auto rounded bg-bg-raised px-1.5 py-0.5 font-mono-tech text-[12px] text-text-secondary">
          {suspects.length}
        </span>
      </div>

      <div className="perspective flex-1 space-y-2 overflow-y-auto p-3">
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
              <Tilt3D maxTilt={5} className="rounded-lg">
                <button
                  onClick={() => onSelectVessel(vessel.id)}
                  className={`w-full rounded-lg border px-3 py-2.5 text-left transition-colors ${
                    isSelected
                      ? 'border-accent-cyan/50 bg-accent-cyan/[0.07] shadow-glassCyan backdrop-blur-md'
                      : 'glass-subtle hover:border-white/15'
                  }`}
                >
              <div className="mb-1.5 flex items-center gap-2">
                <span className="font-mono-tech text-lg font-bold leading-none text-text-muted">
                  {String(vessel.rank).padStart(2, '0')}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-mono-tech text-xs font-semibold text-text-primary">
                    {vessel.name}
                  </div>
                  <div className="font-mono-tech text-[12px] text-text-muted">IMO {vessel.imo}</div>
                </div>
                <span
                  className={`shrink-0 rounded border px-1.5 py-0.5 font-mono-tech text-[10px] font-semibold uppercase tracking-wider ${risk.text} ${risk.bg} ${risk.border}`}
                >
                  {attr.risk}
                </span>
              </div>

              <div className="mb-2 flex items-baseline gap-1">
                <span className="font-mono-tech text-xl font-bold tabular-nums text-accent-cyan">
                  {attr.attributionScorePct.toFixed(1)}%
                </span>
                <span className="font-mono-tech text-[12px] text-text-muted">attribution</span>
              </div>

              <div className="grid grid-cols-2 gap-x-3 gap-y-1 font-mono-tech text-[12px] text-text-secondary">
                <span className="flex items-center gap-1">
                  <MapPin size={10} className="text-text-muted" /> {attr.distanceNm} NM
                </span>
                <span className="flex items-center gap-1">
                  <Clock size={10} className="text-text-muted" /> +{attr.timeDifferenceMinutes}m
                </span>
                <span className="flex items-center gap-1">
                  <Route size={10} className="text-text-muted" /> {attr.trajectoryMatchPct}% match
                </span>
                <span className="flex items-center gap-1">
                  <AlertTriangle size={10} className="text-text-muted" /> {attr.behaviorAnomaly}
                </span>
              </div>
                </button>
              </Tilt3D>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

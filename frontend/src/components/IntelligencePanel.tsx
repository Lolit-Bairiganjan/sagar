import { AnimatePresence, motion } from 'framer-motion';
import { Radar, Satellite, X, ShieldAlert, ArrowLeft } from 'lucide-react';
import type { Spill, Vessel, SatelliteObservation, OceanographicData, RiskLevel } from '../types';
import AttributionScore from './AttributionScore';
import OceanDataPanel from './OceanDataPanel';
import DossierButton from './DossierButton';
import { formatIndianTime } from '../utils/time';
import { soundEngine } from '../utils/soundEngine';

const RISK_STYLES: Record<RiskLevel, string> = {
  CRITICAL: 'text-accent-red border-accent-red/40 bg-accent-red/10',
  HIGH: 'text-[#FF6600] border-[#FF6600]/40 bg-[#FF6600]/10',
  MEDIUM: 'text-accent-amber border-accent-amber/40 bg-accent-amber/10',
  LOW: 'text-accent-green border-accent-green/40 bg-accent-green/10',
};

const SEVERITY_COLOR = {
  INFO: '#7F8EA3',
  WARNING: '#F0A93D',
  CRITICAL: '#F0473D',
};

function Section({ title, children, isLight = false }: { title: string; children: React.ReactNode; isLight?: boolean }) {
  return (
    <div className={`border-b px-4 py-3.5 last:border-b-0 ${isLight ? 'border-black/10' : 'border-[#252932]'}`}>
      <div className="font-mono text-[10px] tracking-wider uppercase text-[#FF6600] font-semibold mb-2.5">
        {title}
      </div>
      {children}
    </div>
  );
}

function StatRow({ label, value, valueClassName }: { label: string; value: string; valueClassName?: string }) {
  return (
    <div className="flex items-center justify-between py-1 font-mono text-xs">
      <span className="text-[#8E95A5]">{label}</span>
      <span className={valueClassName ?? 'font-semibold text-inherit'}>{value}</span>
    </div>
  );
}

function CorrelationRing({ label, pct }: { label: string; pct: number }) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-1.5 px-0.5">
      <div className="relative h-12 w-12">
        <svg viewBox="0 0 44 44" className="h-12 w-12 -rotate-90">
          <circle cx="22" cy="22" r="18" fill="none" stroke="#252932" strokeWidth="4" />
          <motion.circle
            cx="22"
            cy="22"
            r="18"
            fill="none"
            stroke="#FF6600"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={2 * Math.PI * 18}
            initial={{ strokeDashoffset: 2 * Math.PI * 18 }}
            animate={{ strokeDashoffset: 2 * Math.PI * 18 * (1 - pct / 100) }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center font-mono text-[11px] font-bold text-inherit">
          {Math.round(pct)}%
        </div>
      </div>
      <span className="font-mono text-[8px] tracking-wider uppercase text-[#8E95A5] whitespace-nowrap">{label}</span>
    </div>
  );
}

interface IntelligencePanelProps {
  spill: Spill | null;
  satellite: SatelliteObservation | null;
  ocean: OceanographicData | null;
  selectedVessel: Vessel | null;
  onDeselect: () => void;
  isLight?: boolean;
}

export default function IntelligencePanel({
  spill,
  satellite,
  ocean,
  selectedVessel,
  onDeselect,
  isLight = false,
}: IntelligencePanelProps) {
  return (
    <div
      className={`flex h-full flex-col overflow-y-auto transition-colors ${
        isLight ? 'bg-[#EDEFF4] text-[#14161B]' : 'bg-[#181B22] text-white'
      }`}
    >
      {/* Back to Suspect List Header Bar */}
      <div
        className={`flex items-center justify-between border-b px-4 py-2.5 ${
          isLight ? 'border-black/10 bg-white' : 'border-[#252932] bg-[#14161B]'
        }`}
      >
        <button
          onClick={onDeselect}
          onMouseEnter={() => soundEngine.playBubbleHover()}
          className={`inline-flex items-center gap-1.5 border px-2.5 py-1 font-mono text-[11px] font-bold transition-all cursor-pointer ${
            isLight
              ? 'border-black/15 bg-[#EDEFF4] text-[#14161B] hover:border-[#FF6600] hover:text-[#FF6600]'
              : 'border-[#2D323E] bg-[#1B1E25] text-[#A2A8B5] hover:border-[#FF6600] hover:text-white'
          }`}
          title="Return to Suspect Vessels List"
        >
          <ArrowLeft size={12} className="text-[#FF6600]" />
          <span>BACK TO SUSPECTS</span>
        </button>

        <button
          onClick={onDeselect}
          onMouseEnter={() => soundEngine.playBubbleHover()}
          className="p-1 text-[#6B7280] hover:text-[#FF6600] transition-colors cursor-pointer"
          aria-label="Close dossier"
        >
          <X size={15} />
        </button>
      </div>

      <AnimatePresence mode="wait">
        {selectedVessel && selectedVessel.attribution ? (
          <motion.div
            key={selectedVessel.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
          >
            <div
              className={`border-b px-4 py-3.5 ${
                isLight ? 'border-black/10 bg-white' : 'border-[#252932] bg-[#14161B]'
              }`}
            >
              <div className="font-mono text-[10px] tracking-wider uppercase text-[#6B7280]">
                Vessel Dossier
              </div>
              <div className="font-mono text-base font-bold text-inherit truncate">
                {selectedVessel.name}
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <span
                  className={`inline-block border px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider ${
                    RISK_STYLES[selectedVessel.attribution.risk]
                  }`}
                >
                  {selectedVessel.attribution.risk} RISK
                </span>
                <span className="font-mono text-[11px] text-[#6B7280]">IMO {selectedVessel.imo}</span>
              </div>
            </div>

            <Section title="Vessel Details" isLight={isLight}>
              <StatRow label="IMO" value={selectedVessel.imo} />
              <StatRow label="Type" value={selectedVessel.type} />
              <StatRow label="Flag" value={selectedVessel.flag} />
              <StatRow label="Speed" value={`${selectedVessel.speedKn.toFixed(1)} knots`} />
              <StatRow label="Heading" value={`${selectedVessel.headingDeg}°`} />
              <StatRow label="Draft" value={`${selectedVessel.draftM.toFixed(1)} m`} />
            </Section>

            <Section title="Correlation Analysis" isLight={isLight}>
              <div className="grid grid-cols-4 gap-x-2 gap-y-2">
                <CorrelationRing label="Spatial" pct={selectedVessel.attribution.correlation.spatialPct} />
                <CorrelationRing label="Temporal" pct={selectedVessel.attribution.correlation.temporalPct} />
                <CorrelationRing label="Trajectory" pct={selectedVessel.attribution.correlation.trajectoryPct} />
                <CorrelationRing label="Behavior" pct={selectedVessel.attribution.correlation.behaviorPct} />
              </div>
              <div className={`mt-3 flex items-center justify-between border-t pt-2 font-mono ${
                isLight ? 'border-black/10' : 'border-[#252932]'
              }`}>
                <span className="text-[12px] tracking-widest text-[#8E95A5]">OVERALL MATCH</span>
                <span className="text-sm font-black text-[#FF6600]">
                  {selectedVessel.attribution.correlation.overallPct.toFixed(1)}%
                </span>
              </div>
            </Section>

            <Section title="Attribution" isLight={isLight}>
              <AttributionScore attribution={selectedVessel.attribution} />
            </Section>

            {selectedVessel.anomalyEvents.length > 0 && (
              <Section title="Behavior Anomaly Timeline">
                <div className="space-y-0">
                  {selectedVessel.anomalyEvents.map((event, i) => (
                    <div key={event.timestampUtc + i} className="relative flex gap-3 pb-3 last:pb-0">
                      <div className="flex flex-col items-center">
                        <span
                          className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{
                            backgroundColor: SEVERITY_COLOR[event.severity],
                            boxShadow:
                              event.severity !== 'INFO'
                                ? `0 0 6px ${SEVERITY_COLOR[event.severity]}`
                                : undefined,
                          }}
                        />
                        {i < selectedVessel.anomalyEvents.length - 1 && (
                          <span className="w-px flex-1 bg-border" />
                        )}
                      </div>
                      <div className="min-w-0 pb-0.5">
                        <div className="flex items-baseline gap-2 font-mono-tech text-[13px]">
                          <span className="text-text-muted">{formatIndianTime(event.timestampUtc, { hour: '2-digit', minute: '2-digit' })}</span>
                          <span
                            className="font-semibold"
                            style={{ color: SEVERITY_COLOR[event.severity] }}
                          >
                            {event.label}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[13px] leading-snug text-text-secondary">
                          {event.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className={`mt-auto border-t p-3 ${isLight ? 'border-black/10 bg-white' : 'border-[#252932] bg-[#14161B]'}`}>
        <DossierButton spill={spill} vessel={selectedVessel} />
      </div>
    </div>
  );
}

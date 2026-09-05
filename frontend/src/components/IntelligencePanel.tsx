import { AnimatePresence, motion } from 'framer-motion';
import { Radar, Satellite, X, ShieldAlert } from 'lucide-react';
import type { Spill, Vessel, SatelliteObservation, OceanographicData, RiskLevel } from '../types';
import AttributionScore from './AttributionScore';
import OceanDataPanel from './OceanDataPanel';
import DossierButton from './DossierButton';
import { formatIndianTime } from '../utils/time';

const RISK_STYLES: Record<RiskLevel, string> = {
  CRITICAL: 'text-accent-red border-accent-red/40 bg-accent-red/10',
  HIGH: 'text-accent-orange border-accent-orange/40 bg-accent-orange/10',
  MEDIUM: 'text-accent-amber border-accent-amber/40 bg-accent-amber/10',
  LOW: 'text-accent-green border-accent-green/40 bg-accent-green/10',
};

const SEVERITY_COLOR = {
  INFO: '#7F8EA3',
  WARNING: '#F0A93D',
  CRITICAL: '#F0473D',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-border px-4 py-4 last:border-b-0">
      <div className="label-eyebrow mb-3">{title}</div>
      {children}
    </div>
  );
}

function StatRow({ label, value, valueClassName }: { label: string; value: string; valueClassName?: string }) {
  return (
    <div className="flex items-center justify-between py-1 font-mono-tech text-xs">
      <span className="text-text-secondary">{label}</span>
      <span className={valueClassName ?? 'text-text-primary'}>{value}</span>
    </div>
  );
}

function CorrelationRing({ label, pct }: { label: string; pct: number }) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-2 px-0.5">
      <div className="relative h-14 w-14">
        <svg viewBox="0 0 44 44" className="h-14 w-14 -rotate-90">
          <circle cx="22" cy="22" r="18" fill="none" stroke="#1A2433" strokeWidth="4" />
          <motion.circle
            cx="22"
            cy="22"
            r="18"
            fill="none"
            stroke="#F28C28"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={2 * Math.PI * 18}
            initial={{ strokeDashoffset: 2 * Math.PI * 18 }}
            animate={{ strokeDashoffset: 2 * Math.PI * 18 * (1 - pct / 100) }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center font-mono-tech text-[13px] font-semibold text-text-primary">
          {Math.round(pct)}%
        </div>
      </div>
      <span className="label-eyebrow text-[8px] tracking-[0.08em] whitespace-nowrap">{label}</span>
    </div>
  );
}

interface IntelligencePanelProps {
  spill: Spill | null;
  satellite: SatelliteObservation | null;
  ocean: OceanographicData | null;
  selectedVessel: Vessel | null;
  onDeselect: () => void;
}

export default function IntelligencePanel({
  spill,
  satellite,
  ocean,
  selectedVessel,
  onDeselect,
}: IntelligencePanelProps) {
  return (
    <div className="glass-strong perspective flex h-full flex-col overflow-y-auto border-y-0 border-r-0">
      <AnimatePresence mode="wait">
        {selectedVessel && selectedVessel.attribution ? (
          <motion.div
            key={selectedVessel.id}
            className="preserve-3d"
            initial={{ opacity: 0, rotateY: 18, x: 20 }}
            animate={{ opacity: 1, rotateY: 0, x: 0 }}
            exit={{ opacity: 0, rotateY: -18, x: -20 }}
            transition={{ duration: 0.72, ease: [0.22, 1, 0.36, 1] }}
            style={{ transformOrigin: 'right center' }}
          >
            <div className="flex items-start justify-between border-b border-white/5 px-4 py-4">
              <div>
                <div className="label-eyebrow mb-1">Vessel Intelligence</div>
                <div className="font-mono-tech text-base font-semibold text-text-primary">
                  {selectedVessel.name}
                </div>
                <span
                  className={`mt-1.5 inline-block rounded border px-1.5 py-0.5 font-mono-tech text-[10px] font-semibold uppercase tracking-wider ${
                    RISK_STYLES[selectedVessel.attribution.risk]
                  }`}
                >
                  {selectedVessel.attribution.risk} RISK
                </span>
              </div>
              <button
                onClick={onDeselect}
                className="rounded p-1 text-text-muted transition-colors hover:bg-bg-raised hover:text-text-primary"
                aria-label="Deselect vessel"
              >
                <X size={14} />
              </button>
            </div>

            <Section title="Vessel Details">
              <StatRow label="IMO" value={selectedVessel.imo} />
              <StatRow label="Type" value={selectedVessel.type} />
              <StatRow label="Flag" value={selectedVessel.flag} />
              <StatRow label="Speed" value={`${selectedVessel.speedKn.toFixed(1)} knots`} />
              <StatRow label="Heading" value={`${selectedVessel.headingDeg}°`} />
              <StatRow label="Draft" value={`${selectedVessel.draftM.toFixed(1)} m`} />
            </Section>

            <Section title="Correlation Analysis">
              <div className="grid grid-cols-4 gap-x-3 gap-y-2">
                <CorrelationRing label="Spatial" pct={selectedVessel.attribution.correlation.spatialPct} />
                <CorrelationRing label="Temporal" pct={selectedVessel.attribution.correlation.temporalPct} />
                <CorrelationRing label="Trajectory" pct={selectedVessel.attribution.correlation.trajectoryPct} />
                <CorrelationRing label="Behavior" pct={selectedVessel.attribution.correlation.behaviorPct} />
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-border pt-2">
                <span className="font-mono-tech text-[13px] tracking-widest text-text-secondary">OVERALL</span>
                <span className="font-mono-tech text-sm font-bold text-accent-cyan">
                  {selectedVessel.attribution.correlation.overallPct.toFixed(1)}%
                </span>
              </div>
            </Section>

            <Section title="Attribution">
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

      <div className="mt-auto border-t border-white/5 p-3">
        <DossierButton spill={spill} vessel={selectedVessel} />
      </div>
    </div>
  );
}

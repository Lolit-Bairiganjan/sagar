import { motion } from 'framer-motion';
import type { VesselAttribution } from '../types';

interface AttributionScoreProps {
  attribution: VesselAttribution;
}

function ScoreBar({ label, score, max }: { label: string; score: number; max: number }) {
  const pct = (score / max) * 100;
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between font-mono-tech text-[12px] text-text-secondary">
        <span>{label}</span>
        <span className="text-text-primary">
          {score}/{max}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg-raised">
        <motion.div
          className="h-full rounded-full bg-accent-cyan"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}

export default function AttributionScore({ attribution }: AttributionScoreProps) {
  const { breakdown, attributionScorePct } = attribution;
  const totalScore =
    breakdown.spatialProximity.score +
    breakdown.temporalCorrelation.score +
    breakdown.trajectoryMatch.score +
    breakdown.behaviorAnomaly.score;
  const totalMax =
    breakdown.spatialProximity.max +
    breakdown.temporalCorrelation.max +
    breakdown.trajectoryMatch.max +
    breakdown.behaviorAnomaly.max;

  return (
    <div>
      <div className="label-eyebrow mb-1">Attribution Score</div>
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-3 font-mono-tech text-3xl font-semibold tabular-nums text-accent-cyan"
      >
        {attributionScorePct.toFixed(1)}
        <span className="text-lg text-text-secondary">%</span>
      </motion.div>

      <div className="glass-subtle space-y-2.5 rounded-md p-2.5">
        <ScoreBar label="Spatial Proximity" score={breakdown.spatialProximity.score} max={breakdown.spatialProximity.max} />
        <ScoreBar label="Temporal Correlation" score={breakdown.temporalCorrelation.score} max={breakdown.temporalCorrelation.max} />
        <ScoreBar label="Trajectory Match" score={breakdown.trajectoryMatch.score} max={breakdown.trajectoryMatch.max} />
        <ScoreBar label="Behavior Anomaly" score={breakdown.behaviorAnomaly.score} max={breakdown.behaviorAnomaly.max} />
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-border pt-2 font-mono-tech text-[13px]">
        <span className="tracking-widest text-text-secondary">TOTAL</span>
        <span className="font-semibold text-text-primary">
          {totalScore}/{totalMax}
        </span>
      </div>
    </div>
  );
}

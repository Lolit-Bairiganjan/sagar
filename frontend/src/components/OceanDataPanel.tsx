import { motion } from 'framer-motion';
import { Wind, Waves, Thermometer, Navigation } from 'lucide-react';
import type { OceanographicData } from '../types';

interface OceanDataPanelProps {
  data: OceanographicData | null;
}

function Metric({
  icon: Icon,
  label,
  value,
  sub,
  rotation,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  rotation?: number;
}) {
  return (
    <motion.div
      whileHover={{ y: -2, rotateX: 6 }}
      style={{ transformPerspective: 300 }}
      className="glass-subtle flex items-center gap-2 rounded-md p-1.5"
    >
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-white/10 bg-white/[0.03]">
        <Icon
          size={13}
          className="text-accent-cyan"
          style={rotation !== undefined ? { transform: `rotate(${rotation}deg)` } : undefined}
        />
      </div>
      <div className="leading-tight">
        <div className="label-eyebrow">{label}</div>
        <div className="font-mono-tech text-xs font-semibold text-text-primary">
          {value}
          {sub && <span className="ml-1 text-text-muted">{sub}</span>}
        </div>
      </div>
    </motion.div>
  );
}

export default function OceanDataPanel({ data }: OceanDataPanelProps) {
  if (!data) {
    return (
      <div className="grid animate-pulse grid-cols-2 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-9 rounded bg-bg-raised" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      <Metric
        icon={Wind}
        label="Wind"
        value={`${data.windDirectionDeg}°`}
        sub={`${data.windSpeedKn} kn`}
        rotation={data.windDirectionDeg}
      />
      <Metric
        icon={Navigation}
        label="Current"
        value={`${data.currentDirectionDeg}°`}
        sub={`${data.currentSpeedKn} kn`}
        rotation={data.currentDirectionDeg}
      />
      <Metric icon={Waves} label="Sea State" value={`${data.seaStateM} m`} />
      <Metric icon={Thermometer} label="Temperature" value={`${data.temperatureC}°C`} />
    </div>
  );
}

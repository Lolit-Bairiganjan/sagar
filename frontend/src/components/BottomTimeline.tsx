import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, Play, Pause } from 'lucide-react';
import type { TimelineToken } from '../types';

const TOKENS: TimelineToken[] = ['T-12h', 'T-8h', 'T-4h', 'T-2h', 'NOW', 'T+2h', 'T+4h', 'T+8h'];
const SPEEDS = [1, 2, 5, 10] as const;

interface BottomTimelineProps {
  onIndexChange?: (index: number, token: TimelineToken) => void;
}

export default function BottomTimeline({ onIndexChange }: BottomTimelineProps) {
  const [index, setIndex] = useState(TOKENS.indexOf('NOW'));
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    onIndexChange?.(index, TOKENS[index]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  useEffect(() => {
    if (playing) {
      intervalRef.current = setInterval(
        () => {
          setIndex((i) => (i + 1) % TOKENS.length);
        },
        Math.max(1800 / speed, 180),
      );
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [playing, speed]);

  return (
    <div className="glass-strong relative z-20 flex h-16 shrink-0 items-center gap-4 rounded-none border-x-0 border-b-0 px-4">
      {/* Transport controls */}
      <div className="flex items-center gap-1.5">
        <motion.button
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          whileHover={{ rotateY: -20, scale: 1.05 }}
          whileTap={{ scale: 0.9 }}
          style={{ transformPerspective: 300 }}
          className="rounded border border-white/10 p-1.5 text-text-secondary transition-colors hover:border-accent-cyan/40 hover:text-accent-cyan"
          aria-label="Previous"
        >
          <ChevronLeft size={14} />
        </motion.button>
        <motion.button
          onClick={() => setPlaying((p) => !p)}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.9, rotateX: 15 }}
          style={{ transformPerspective: 300 }}
          className="rounded border border-accent-cyan/40 bg-accent-cyan/10 p-1.5 text-accent-cyan shadow-glowCyan transition-colors hover:bg-accent-cyan/20"
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {playing ? <Pause size={14} /> : <Play size={14} />}
        </motion.button>
      </div>

      {/* Speed */}
      <div className="flex items-center gap-1 border-r border-border pr-4 font-mono-tech text-[12px]">
        {SPEEDS.map((s) => (
          <button
            key={s}
            onClick={() => setSpeed(s)}
            className={`rounded px-1.5 py-1 transition-colors ${
              speed === s ? 'bg-bg-raised text-accent-cyan' : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            {s}x
          </button>
        ))}
      </div>

      {/* Timeline track */}
      <div className="relative flex flex-1 items-center">
        <div className="absolute left-0 right-0 h-px bg-border" />
        <div className="relative flex w-full justify-between">
          {TOKENS.map((token, i) => {
            const isActive = i === index;
            const isPast = i < index;
            return (
              <button
                key={token}
                onClick={() => setIndex(i)}
                className="group flex flex-col items-center gap-1.5"
              >
                <span
                  className={`h-2.5 w-2.5 rounded-full border transition-all ${
                    isActive
                      ? 'scale-125 border-accent-cyan bg-accent-cyan shadow-[0_0_8px_rgba(242,140,40,0.8)]'
                      : isPast
                        ? 'border-accent-cyan/50 bg-accent-cyan/30'
                        : 'border-border bg-bg-raised group-hover:border-border-bright'
                  }`}
                />
                <span
                  className={`font-mono-tech text-[12px] tracking-wide ${
                    isActive ? 'font-semibold text-accent-cyan' : token === 'NOW' ? 'text-text-primary' : 'text-text-muted'
                  }`}
                >
                  {token}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, Play, Pause } from 'lucide-react';
import type { TimelineToken } from '../types';
import { soundEngine } from '../utils/soundEngine';

const TOKENS: TimelineToken[] = ['T-12h', 'T-8h', 'T-4h', 'T-2h', 'NOW', 'T+2h', 'T+4h', 'T+8h'];
const SPEEDS = [1, 2, 5, 10] as const;

interface BottomTimelineProps {
  onIndexChange?: (index: number, token: TimelineToken) => void;
  isLight?: boolean;
}

export default function BottomTimeline({ onIndexChange, isLight = false }: BottomTimelineProps) {
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
    <div
      className={`relative z-20 flex h-14 shrink-0 items-center gap-4 border-t px-4 transition-colors ${
        isLight
          ? 'bg-[#EDEFF4] border-[#CBD0DA] text-[#14161B]'
          : 'bg-[#14161B] border-[#252932] text-white'
      }`}
    >
      {/* Transport controls */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => {
            soundEngine.playBubbleHover();
            setIndex((i) => Math.max(0, i - 1));
          }}
          onMouseEnter={() => soundEngine.playBubbleHover()}
          className={`border p-1.5 transition-colors cursor-pointer select-none ${
            isLight
              ? 'border-black/15 bg-white text-[#4B5262] hover:border-[#FF6600] hover:text-[#FF6600]'
              : 'border-[#2D323E] bg-[#181B22] text-[#A2A8B5] hover:border-[#FF6600] hover:text-white'
          }`}
          aria-label="Previous"
        >
          <ChevronLeft size={13} />
        </button>
        <button
          onClick={() => {
            soundEngine.playBubbleHover();
            setPlaying((p) => !p);
          }}
          onMouseEnter={() => soundEngine.playBubbleHover()}
          className={`border p-1.5 transition-all cursor-pointer select-none ${
            playing
              ? 'border-[#FF6600] bg-[#FF6600] text-white shadow-[0_0_10px_rgba(255,102,0,0.4)]'
              : 'border-[#FF6600]/40 bg-[#FF6600]/10 text-[#FF6600] hover:bg-[#FF6600]/20'
          }`}
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {playing ? <Pause size={13} /> : <Play size={13} />}
        </button>
      </div>

      {/* Speed */}
      <div
        className={`flex items-center gap-1 border-r pr-4 font-mono text-[11px] ${
          isLight ? 'border-black/15' : 'border-[#252932]'
        }`}
      >
        {SPEEDS.map((s) => (
          <button
            key={s}
            onClick={() => {
              soundEngine.playBubbleHover();
              setSpeed(s);
            }}
            onMouseEnter={() => soundEngine.playBubbleHover()}
            className={`px-1.5 py-0.5 font-bold transition-colors cursor-pointer ${
              speed === s
                ? 'border border-[#FF6600] bg-[#FF6600]/15 text-[#FF6600]'
                : 'text-[#6B7280] hover:text-[#FF6600]'
            }`}
          >
            {s}x
          </button>
        ))}
      </div>

      {/* Timeline track */}
      <div className="relative flex flex-1 items-center">
        <div
          className={`absolute left-0 right-0 h-px ${
            isLight ? 'bg-black/10' : 'bg-[#252932]'
          }`}
        />
        <div className="relative flex w-full justify-between">
          {TOKENS.map((token, i) => {
            const isActive = i === index;
            const isPast = i < index;
            return (
              <button
                key={token}
                onClick={() => {
                  soundEngine.playBubbleHover();
                  setIndex(i);
                }}
                onMouseEnter={() => soundEngine.playBubbleHover()}
                className="group flex flex-col items-center gap-1 cursor-pointer"
              >
                <span
                  className={`h-2.5 w-2.5 transition-all ${
                    isActive
                      ? 'scale-125 bg-[#FF6600] shadow-[0_0_8px_rgba(255,102,0,0.8)]'
                      : isPast
                      ? 'bg-[#FF6600]/50'
                      : isLight
                      ? 'bg-black/20'
                      : 'bg-[#2D323E]'
                  }`}
                />
                <span
                  className={`font-mono text-[10px] tracking-wider ${
                    isActive
                      ? 'font-bold text-[#FF6600]'
                      : token === 'NOW'
                      ? 'font-semibold text-inherit'
                      : 'text-[#6B7280]'
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

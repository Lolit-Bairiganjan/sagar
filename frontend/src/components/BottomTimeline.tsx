import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Play, Pause } from 'lucide-react';
import type { ReconstructionFrame } from '../types';
import { soundEngine } from '../utils/soundEngine';

const SPEEDS = [1, 2, 5, 10] as const;

interface BottomTimelineProps {
  frames: ReconstructionFrame[];
  selectedIndex: number;
  onIndexChange: (index: number) => void;
  loading?: boolean;
  error?: string | null;
  isLight?: boolean;
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;
  return `${date.toISOString().replace('T', ' ').slice(0, 16)} UTC`;
}

export default function BottomTimeline({
  frames,
  selectedIndex,
  onIndexChange,
  loading = false,
  error = null,
  isLight = false,
}: BottomTimelineProps) {
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const hasFrames = frames.length > 0;
  const safeIndex = hasFrames
    ? Math.max(0, Math.min(selectedIndex, frames.length - 1))
    : 0;
  const activeFrame = frames[safeIndex];

  useEffect(() => {
    if (!playing || !hasFrames) return;
    if (safeIndex >= frames.length - 1) {
      setPlaying(false);
      return;
    }

    const interval = setInterval(() => {
      onIndexChange(safeIndex + 1);
    }, Math.max(1800 / speed, 180));
    return () => clearInterval(interval);
  }, [frames.length, hasFrames, onIndexChange, playing, safeIndex, speed]);

  const status = loading
    ? 'Loading persisted reconstruction…'
    : error
      ? `Reconstruction unavailable: ${error}`
      : hasFrames
        ? `${safeIndex + 1} / ${frames.length} frames`
        : 'No persisted reconstruction frames for this spill';

  return (
    <div
      className={`relative z-20 flex min-h-16 shrink-0 items-center gap-3 border-t px-4 py-2 transition-colors ${
        isLight
          ? 'bg-[#EDEFF4] border-[#CBD0DA] text-[#14161B]'
          : 'bg-[#14161B] border-[#252932] text-white'
      }`}
    >
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          disabled={!hasFrames || safeIndex === 0}
          onClick={() => {
            soundEngine.playBubbleHover();
            onIndexChange(Math.max(0, safeIndex - 1));
          }}
          className={`border p-1.5 transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
            isLight
              ? 'border-black/15 bg-white text-[#4B5262] hover:border-[#FF6600] hover:text-[#FF6600]'
              : 'border-[#2D323E] bg-[#181B22] text-[#A2A8B5] hover:border-[#FF6600] hover:text-white'
          }`}
          aria-label="Previous reconstruction frame"
        >
          <ChevronLeft size={13} />
        </button>
        <button
          disabled={!hasFrames}
          onClick={() => {
            soundEngine.playBubbleHover();
            if (!playing && safeIndex >= frames.length - 1) onIndexChange(0);
            setPlaying(!playing);
          }}
          className="border border-[#FF6600]/40 bg-[#FF6600]/10 p-1.5 text-[#FF6600] transition-all hover:bg-[#FF6600]/20 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label={playing ? 'Pause reconstruction' : 'Play reconstruction'}
        >
          {playing ? <Pause size={13} /> : <Play size={13} />}
        </button>
        <button
          disabled={!hasFrames || safeIndex >= frames.length - 1}
          onClick={() => {
            soundEngine.playBubbleHover();
            onIndexChange(Math.min(frames.length - 1, safeIndex + 1));
          }}
          className={`border p-1.5 transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
            isLight
              ? 'border-black/15 bg-white text-[#4B5262] hover:border-[#FF6600] hover:text-[#FF6600]'
              : 'border-[#2D323E] bg-[#181B22] text-[#A2A8B5] hover:border-[#FF6600] hover:text-white'
          }`}
          aria-label="Next reconstruction frame"
        >
          <ChevronRight size={13} />
        </button>
      </div>

      <div
        className={`flex shrink-0 items-center gap-1 border-r pr-3 font-mono text-[10px] ${
          isLight ? 'border-black/15' : 'border-[#252932]'
        }`}
        aria-label="Playback speed"
      >
        {SPEEDS.map((value) => (
          <button
            key={value}
            onClick={() => {
              soundEngine.playBubbleHover();
              setSpeed(value);
            }}
            className={`px-1 py-0.5 font-bold transition-colors ${
              speed === value ? 'text-[#FF6600]' : 'text-[#6B7280] hover:text-[#FF6600]'
            }`}
            aria-pressed={speed === value}
          >
            {value}x
          </button>
        ))}
      </div>

      <div className="min-w-0 flex-1">
        <input
          type="range"
          min={0}
          max={Math.max(frames.length - 1, 0)}
          step={1}
          value={safeIndex}
          disabled={!hasFrames || loading}
          onChange={(event) => {
            setPlaying(false);
            onIndexChange(Number(event.target.value));
          }}
          className="h-1.5 w-full cursor-pointer accent-[#FF6600] disabled:cursor-not-allowed"
          aria-label="Reconstruction time frame"
          aria-valuetext={activeFrame ? formatTimestamp(activeFrame.timestampUtc) : status}
        />
        <div className="flex justify-between gap-2 font-mono text-[9px] text-[#8E95A5]">
          <span className="truncate">
            {frames.length > 0 ? formatTimestamp(frames[0].timestampUtc) : 'Estimated release'}
          </span>
          <span className="shrink-0 text-[#FF6600]">
            {activeFrame ? `${activeFrame.label} · ${formatTimestamp(activeFrame.timestampUtc)}` : status}
          </span>
          <span className="truncate text-right">
            {frames.length > 0
              ? formatTimestamp(frames[frames.length - 1].timestampUtc)
              : loading
                ? 'Fetching frames'
                : 'Detection'}
          </span>
        </div>
        {hasFrames && (
          <div className="mt-1 font-mono text-[9px] text-amber-500">
            Coastline not modeled (path may cross land); slick breakup, emulsification, and area change are not represented.
          </div>
        )}
      </div>
      <div className="hidden max-w-52 shrink-0 text-right font-mono text-[9px] text-[#8E95A5] xl:block">
        {status}
      </div>
    </div>
  );
}

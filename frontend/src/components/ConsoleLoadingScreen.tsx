import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface ConsoleLoadingScreenProps {
  onComplete: () => void;
  isLight?: boolean;
}

const TELEMETRY_STEPS = [
  'INITIALIZING MARITIME RECONNAISSANCE ENGINE...',
  'INGESTING COPERNICUS SENTINEL-1 C-BAND SAR (5.405 GHz)...',
  'EXECUTING YOLOv8-SEG NEURAL INSTANCE SEGMENTATION...',
  'COMPUTING 3H EULERIAN REVERSE-DRIFT LEEWAY TRAJECTORY...',
  'CORRELATING POSTGIS AIS TRANSPONDER RECORDS...',
  'ATTRIBUTION MATRIX COMPILED. LAUNCHING COMMAND DECK...',
];

/* ─────────────────────────────────────────────────────────────
   Cartoony Tanker Ship with Billowing Smoke & Oil Discharge Plume
   ───────────────────────────────────────────────────────────── */
function SailingSpillingShipSVG({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 460 210"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        {/* Iridescent oil slick sheen gradient */}
        <linearGradient id="oilSlickGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#0B0D11" stopOpacity="0.95" />
          <stop offset="35%" stopColor="#1B1724" stopOpacity="0.9" />
          <stop offset="65%" stopColor="#2A1B18" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#FF6600" stopOpacity="0.4" />
        </linearGradient>

        <linearGradient id="waterSurface" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#0066CC" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#002244" stopOpacity="0.6" />
        </linearGradient>
      </defs>

      {/* ── Billowing Smoke Puffs From Smokestack ── */}
      <g>
        <circle cx="304" cy="38" r="6" fill="#A0A6B5" className="animate-smoke-1" />
        <circle cx="300" cy="35" r="5" fill="#CBD0DC" className="animate-smoke-2" />
        <circle cx="302" cy="36" r="4.5" fill="#7E8698" className="animate-smoke-3" />
      </g>

      {/* ── Trailing Oil Spill Discharged Behind Ship (Wake) ── */}
      <g>
        {/* Deep expanding oil slick plume */}
        <path
          d="M 12 165 C 50 156, 90 174, 150 162 C 180 158, 205 168, 230 166 L 225 178 C 175 182, 130 174, 70 184 C 30 190, 10 178, 12 165 Z"
          fill="url(#oilSlickGradient)"
          className="animate-pulse"
        />
        {/* Ominous red/orange warning contour on spill edges */}
        <path
          d="M 15 166 Q 90 158 160 164 T 228 166"
          stroke="#FF6600"
          strokeWidth="1.5"
          strokeDasharray="4 4"
          opacity="0.8"
        />
        <path
          d="M 25 176 Q 110 172 175 177 T 224 176"
          stroke="#FF3300"
          strokeWidth="1.2"
          strokeDasharray="6 4"
          opacity="0.6"
        />

        {/* Floating oil slick droplets trailing in wake */}
        <ellipse cx="65" cy="172" rx="14" ry="4" fill="#0E1015" stroke="#FF6600" strokeWidth="0.8" opacity="0.85" />
        <ellipse cx="115" cy="168" rx="20" ry="5" fill="#12141C" opacity="0.9" />
        <ellipse cx="170" cy="170" rx="16" ry="4.5" fill="#0B0D12" stroke="#FF4400" strokeWidth="0.7" opacity="0.85" />

        {/* Bilge discharge pipe dripping oil at ship's stern */}
        <rect x="226" y="146" width="6" height="4" fill="#555D6E" />
        <circle cx="229" cy="154" r="2.5" fill="#FF4400" className="animate-ping" />
        <circle cx="229" cy="158" r="3" fill="#14161B" />
      </g>

      {/* ── Ship Hull ── */}
      <path
        d="M135 140 L155 170 L345 170 L365 140 Z"
        fill="#1E222A"
        stroke="#3B4252"
        strokeWidth="2.5"
      />
      {/* Orange waterline stripe */}
      <rect x="158" y="154" width="184" height="6.5" fill="#FF6600" />

      {/* Main Deck */}
      <rect x="152" y="116" width="196" height="24" fill="#2E3440" />

      {/* Superstructure / Wheelhouse */}
      <rect x="275" y="74" width="60" height="42" fill="#ECEFF4" stroke="#D8DEE9" strokeWidth="1.5" />
      {/* Navigation bridge windows */}
      <rect x="283" y="82" width="16" height="10" fill="#181A20" />
      <rect x="307" y="82" width="16" height="10" fill="#181A20" />
      {/* Roof cap */}
      <rect x="271" y="68" width="68" height="6" fill="#1E222A" />

      {/* Smokestack */}
      <rect x="294" y="46" width="18" height="22" fill="#FF6600" />
      <rect x="290" y="42" width="26" height="4" fill="#E05500" />

      {/* Cargo Tanks / Containers */}
      <rect x="170" y="98" width="28" height="18" fill="#FF6600" />
      <rect x="204" y="98" width="28" height="18" fill="#434C5E" />
      <rect x="238" y="98" width="24" height="18" fill="#FF7711" />

      {/* Portholes */}
      <circle cx="190" cy="130" r="4" fill="#687385" />
      <circle cx="220" cy="130" r="4" fill="#687385" />
      <circle cx="250" cy="130" r="4" fill="#687385" />
      <circle cx="280" cy="130" r="4" fill="#687385" />

      {/* Ocean Waterline Wave */}
      <path
        d="M 0 170 Q 115 164 230 170 T 460 170 L 460 210 L 0 210 Z"
        fill="url(#waterSurface)"
        opacity="0.8"
      />
      <path
        d="M 0 170 Q 115 164 230 170 T 460 170"
        stroke="#00A2FF"
        strokeWidth="1.5"
        opacity="0.5"
      />
    </svg>
  );
}

export default function ConsoleLoadingScreen({ onComplete, isLight = false }: ConsoleLoadingScreenProps) {
  const [progress, setProgress] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    const startTime = Date.now();
    const duration = 2400; // 2.4 seconds smooth transition

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, Math.floor((elapsed / duration) * 100));
      setProgress(pct);

      const step = Math.min(
        TELEMETRY_STEPS.length - 1,
        Math.floor((pct / 100) * TELEMETRY_STEPS.length)
      );
      setStepIndex(step);

      if (elapsed >= duration) {
        clearInterval(interval);
        setTimeout(onComplete, 250);
      }
    }, 35);

    return () => clearInterval(interval);
  }, [onComplete]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center p-6 select-none overflow-hidden ${
        isLight ? 'bg-[#EDEFF4] text-[#14161B]' : 'bg-[#14161B] text-white'
      }`}
    >
      {/* Background CAD Grid */}
      <div className="absolute inset-0 chaingpt-grid opacity-35 pointer-events-none" />
      <div className="absolute inset-0 chaingpt-dots opacity-25 pointer-events-none" />

      {/* Subtle radial glow */}
      <div className="absolute h-96 w-96 rounded-full bg-[#FF6600]/10 blur-[120px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-lg flex flex-col items-center text-center">
        {/* Sailing Tanker Ship Spilling Oil */}
        <motion.div
          initial={{ x: -60, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="w-full max-w-sm sm:max-w-md mb-8"
        >
          <SailingSpillingShipSVG className="w-full h-auto drop-shadow-xl" />
        </motion.div>

        {/* Incident Badge */}
        <div className="inline-flex items-center gap-2 border border-[#FF6600]/30 bg-[#FF6600]/10 px-3 py-1 font-mono text-[11px] text-[#FF6600] tracking-widest mb-3">
          <span className="h-1.5 w-1.5 rounded-full bg-[#FF6600] animate-ping" />
          <span>OIL DISCHARGE DETECTED // SENTINEL-1 INGESTION</span>
        </div>

        {/* Main Title */}
        <h2 className="font-display text-xl sm:text-2xl font-black tracking-tight uppercase mb-1">
          SAGAR MISSION CONTROL
        </h2>
        <p className="font-mono text-xs text-[#6B7280] tracking-wider mb-6">
          TACTICAL COMMAND DECK · ARABIAN SEA SECTOR 07
        </p>

        {/* Telemetry Progress Bar Box */}
        <div
          className={`w-full p-4 border transition-colors ${
            isLight
              ? 'bg-white border-black/10 shadow-sm'
              : 'bg-[#181B22] border-[#2D323E]'
          }`}
        >
          {/* Status Step Label */}
          <div className="flex items-center justify-between font-mono text-[11px] tracking-wider mb-2">
            <span className="text-[#FF6600] font-semibold truncate pr-2">
              {TELEMETRY_STEPS[stepIndex]}
            </span>
            <span className="text-white/90 font-bold shrink-0">
              {progress}%
            </span>
          </div>

          {/* Progress Track */}
          <div className="h-1.5 w-full bg-black/25 overflow-hidden border border-white/5">
            <motion.div
              className="h-full bg-gradient-to-r from-[#E05500] via-[#FF6600] to-[#FFAA33]"
              style={{ width: `${progress}%` }}
              transition={{ ease: 'linear' }}
            />
          </div>

          {/* Sub-telemetry details */}
          <div className="mt-3 flex items-center justify-between font-mono text-[10px] text-[#6B7280]">
            <span>COPERNICUS SENTINEL-1</span>
            <span>HYCOM / ECMWF VECTOR INTEGRATION</span>
            <span>POSTGIS AIS</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}


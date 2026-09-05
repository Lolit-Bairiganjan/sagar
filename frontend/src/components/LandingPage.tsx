import React, { useRef, useState, useEffect } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import Lenis from 'lenis';
import {
  Satellite,
  ShieldCheck,
  ArrowRight,
  Cpu,
  Compass,
  ChevronDown,
  ScanSearch,
  Wind,
  Target,
  Activity,
  Layers,
  Sparkles,
  ExternalLink,
  Github,
  Sun,
  Moon,
  Database,
  BarChart3,
  FileText,
  AlertTriangle,
  Anchor,
} from 'lucide-react';

/* ─────────────────────────────────────────────
   Sailing Tanker Ship SVG with Flowing Smoke
   ───────────────────────────────────────────── */
function SailingShipSVG({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 320 180"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* ── Billowing Sailing Smoke Puffs ── */}
      <g>
        <circle cx="204" cy="24" r="5.5" fill="#B0B6C4" className="animate-smoke-1" />
        <circle cx="200" cy="22" r="5" fill="#CBD0DC" className="animate-smoke-2" />
        <circle cx="202" cy="23" r="4" fill="#8E95A5" className="animate-smoke-3" />
      </g>

      {/* Hull */}
      <path
        d="M35 125 L55 155 L245 155 L265 125 Z"
        fill="#1E222A"
        stroke="#3B4252"
        strokeWidth="2"
      />
      {/* Vibrant orange waterline accent */}
      <rect x="58" y="139" width="184" height="6" fill="#FF6600" />

      {/* Main deck */}
      <rect x="52" y="101" width="196" height="24" fill="#2E3440" />

      {/* Superstructure / Wheelhouse */}
      <rect x="175" y="59" width="60" height="42" fill="#ECEFF4" stroke="#D8DEE9" strokeWidth="1.5" />
      {/* Navigation bridge windows */}
      <rect x="183" y="67" width="16" height="10" fill="#181A20" />
      <rect x="207" y="67" width="16" height="10" fill="#181A20" />
      {/* Roof cap */}
      <rect x="171" y="53" width="68" height="6" fill="#1E222A" />

      {/* Smokestack */}
      <rect x="194" y="31" width="18" height="22" fill="#FF6600" />
      <rect x="190" y="27" width="26" height="4" fill="#E05500" />

      {/* Cargo Tanks / Containers */}
      <rect x="70" y="83" width="28" height="18" fill="#FF6600" />
      <rect x="104" y="83" width="28" height="18" fill="#434C5E" />
      <rect x="138" y="83" width="24" height="18" fill="#FF7711" />

      {/* Portholes */}
      <circle cx="90" cy="115" r="4" fill="#687385" />
      <circle cx="120" cy="115" r="4" fill="#687385" />
      <circle cx="150" cy="115" r="4" fill="#687385" />
      <circle cx="180" cy="115" r="4" fill="#687385" />
    </svg>
  );
}

/* ─────────────────────────────────────────────
   ChainGPT Style Aquarium Specimen Incubator
   ───────────────────────────────────────────── */
interface AquariumChamberProps {
  shipRotate: any;
  shipY: any;
  bubbleOpacity: any;
}

function AquariumChamber({ shipRotate, shipY, bubbleOpacity }: AquariumChamberProps) {
  return (
    <div className="relative mx-auto w-full max-w-[340px] sm:max-w-[400px] select-none">
      {/* Top Mechanical Cap */}
      <div className="relative z-20 flex flex-col items-center">
        <div className="h-4 w-3/5 bg-gradient-to-b from-[#FFFFFF] to-[#E2E5EB] border border-[#CBD0DA] shadow-sm" />
        <div className="relative h-16 w-full bg-gradient-to-r from-[#ECEFF4] via-[#FFFFFF] to-[#E2E6EE] border border-[#C5CAD6] shadow-md flex items-center justify-center">
          <div className="absolute top-0 bottom-0 w-[1.5px] bg-[#B0B7C4]/60" />
          <div className="flex items-center gap-1.5 px-3 py-1 bg-[#14161B] border border-white/10 text-[9px] font-mono tracking-widest text-[#FF6600]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#FF6600] animate-ping" />
            <span>INCUBATOR // CHAMBER 01</span>
          </div>
        </div>
      </div>

      {/* Cylindrical Glass Chamber with Flanking Pillars */}
      <div className="relative z-10 h-[380px] sm:h-[420px] w-full flex overflow-hidden">
        {/* Left White Pillar */}
        <div className="w-8 sm:w-10 h-full bg-gradient-to-r from-[#E5E9F0] via-[#F8FAFC] to-[#D5DAE5] border-x border-[#C2C7D4] relative z-20 shrink-0">
          <div className="absolute top-1/2 left-0 right-0 h-[1.5px] bg-[#B0B7C4]/70" />
        </div>

        {/* Center Transparent Glass Volume */}
        <div className="relative flex-1 h-full aquarium-glass overflow-hidden flex flex-col justify-between">
          <div className="pointer-events-none absolute top-0 bottom-0 left-3 w-[2px] bg-white/20 blur-[0.5px]" />
          <div className="pointer-events-none absolute top-0 bottom-0 right-5 w-[1px] bg-white/15" />

          {/* Water Volume (Bottom half with surface ripple) */}
          <div className="absolute inset-x-0 bottom-0 h-[72%] bg-gradient-to-b from-[#0099FF]/15 via-[#0066CC]/25 to-[#003366]/45 border-t border-cyan-400/40">
            <div className="absolute top-0 inset-x-0 h-1 bg-cyan-300/30 blur-[1px]" />

            {/* Rising Bubbles */}
            <motion.div
              style={{ opacity: bubbleOpacity }}
              className="absolute inset-0 pointer-events-none"
            >
              {[
                { left: '20%', delay: '0s', size: 5 },
                { left: '45%', delay: '1.2s', size: 7 },
                { left: '70%', delay: '0.6s', size: 4 },
                { left: '35%', delay: '2.4s', size: 6 },
                { left: '80%', delay: '1.8s', size: 5 },
              ].map((b, i) => (
                <div
                  key={i}
                  className="absolute bottom-2 rounded-full border border-cyan-200/50 bg-cyan-100/30 animate-float-bubble"
                  style={{
                    left: b.left,
                    width: `${b.size}px`,
                    height: `${b.size}px`,
                    animationDelay: b.delay,
                  }}
                />
              ))}
            </motion.div>
          </div>

          {/* Floating / Sinking Specimen: Cargo Ship */}
          <div className="relative z-10 w-full h-full flex items-center justify-center">
            <motion.div
              style={{
                rotate: shipRotate,
                y: shipY,
              }}
              className="w-48 sm:w-56 drop-shadow-[0_15px_25px_rgba(0,0,0,0.7)]"
            >
              <SailingShipSVG className="w-full h-auto" />
            </motion.div>
          </div>

          {/* Checkered Flag Decal Band (from ChainGPT screenshot) */}
          <div className="relative z-10 mx-auto mb-4 w-3/4 h-5 checkered-band border-y border-white/20 opacity-85 shadow-sm" />
        </div>

        {/* Right White Pillar */}
        <div className="w-8 sm:w-10 h-full bg-gradient-to-l from-[#E5E9F0] via-[#F8FAFC] to-[#D5DAE5] border-x border-[#C2C7D4] relative z-20 shrink-0">
          <div className="absolute top-1/2 left-0 right-0 h-[1.5px] bg-[#B0B7C4]/70" />
        </div>
      </div>

      {/* Orange Dividing Accent Ring */}
      <div className="relative z-20 h-2.5 w-full bg-gradient-to-r from-[#E05500] via-[#FF6600] to-[#E05500] border-y border-[#FF8833] shadow-[0_0_12px_rgba(255,102,0,0.5)]" />

      {/* Heavy Flared Pedestal Base */}
      <div className="relative z-20 flex flex-col items-center">
        <div className="relative h-20 w-full bg-gradient-to-r from-[#E2E6EE] via-[#FFFFFF] to-[#ECEFF4] border border-[#CBD0DA] shadow-xl flex items-center justify-center">
          <div className="absolute top-0 bottom-0 w-[1.5px] bg-[#B0B7C4]/60" />
          <div className="z-10 flex flex-col items-center gap-0.5">
            <span className="font-display font-bold text-xs tracking-widest text-[#14161B]">
              SPECIMEN ANALYSIS
            </span>
            <span className="font-mono text-[9px] tracking-wider text-[#687080]">
              CAPILLARY WAVE DISSIPATION
            </span>
          </div>
        </div>
        <div className="h-5 w-[105%] bg-gradient-to-b from-[#D5DAE5] to-[#B0B7C4] border-x border-b border-[#9CA3AF]" />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Square Rubber-Band Letter (Persists 2.5s)
   ───────────────────────────────────────────── */
interface RubberBandLetterProps {
  char: string;
}

function RubberBandLetter({ char }: RubberBandLetterProps) {
  const [isStretched, setIsStretched] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsStretched(true);
    // Persist stretched state for 2.5 seconds before smoothly springing back
    timeoutRef.current = setTimeout(() => {
      setIsStretched(false);
    }, 2500);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <motion.div
      onMouseEnter={handleMouseEnter}
      className="relative aspect-square w-20 sm:w-28 lg:w-32 bg-[#1B1E25] border border-[#2D323E] flex items-center justify-center select-none overflow-hidden group cursor-pointer transition-colors duration-300"
      whileHover={{
        borderColor: 'rgba(255, 102, 0, 0.6)',
      }}
    >
      {/* 4 Orange Square Corner Pins */}
      <div className="absolute top-1.5 left-1.5 h-1.5 w-1.5 bg-[#FF6600]" />
      <div className="absolute top-1.5 right-1.5 h-1.5 w-1.5 bg-[#FF6600]" />
      <div className="absolute bottom-1.5 left-1.5 h-1.5 w-1.5 bg-[#FF6600]" />
      <div className="absolute bottom-1.5 right-1.5 h-1.5 w-1.5 bg-[#FF6600]" />

      {/* Proportional Elastic Spring Letter */}
      <motion.span
        animate={
          isStretched
            ? {
                scaleY: 1.2,
                scaleX: 0.9,
                y: -4,
                color: '#FF6600',
              }
            : {
                scaleY: 1,
                scaleX: 1,
                y: 0,
                color: '#FFFFFF',
              }
        }
        transition={{
          type: 'spring',
          stiffness: 350,
          damping: 14,
          mass: 0.7,
        }}
        className="font-display font-black text-4xl sm:text-6xl lg:text-7xl tracking-normal"
      >
        {char}
      </motion.span>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────
   Main Landing Page Component
   ───────────────────────────────────────────── */
interface LandingPageProps {
  onEnter: () => void;
}

export default function LandingPage({ onEnter }: LandingPageProps) {
  const aquariumSectionRef = useRef<HTMLDivElement>(null);
  const [themeMode, setThemeMode] = useState<'dark' | 'contrast'>('dark');

  /* Initialize Lenis smooth scroll with slower deceleration */
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.45,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      smoothWheel: true,
      wheelMultiplier: 0.85,
    });

    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);

    return () => {
      lenis.destroy();
    };
  }, []);

  /* Scroll-driven transformation for the aquarium ship */
  const { scrollYProgress } = useScroll({
    target: aquariumSectionRef,
    offset: ['start end', 'end start'],
  });

  const shipRotate = useTransform(scrollYProgress, [0.2, 0.7], [0, 22]);
  const shipY = useTransform(scrollYProgress, [0.2, 0.75], [0, 160]);
  const bubbleOpacity = useTransform(scrollYProgress, [0.25, 0.65], [0.3, 1]);

  return (
    <div
      style={{ backgroundColor: themeMode === 'dark' ? '#14161B' : '#0E1013' }}
      className="relative min-h-screen w-full text-white selection:bg-[#FF6600]/30 selection:text-white font-sans overflow-x-hidden"
    >
      {/* ── Background CAD Grid & Dark Ambience ── */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 chaingpt-grid opacity-30" />
        <div className="absolute inset-0 chaingpt-dots opacity-20" />
        {/* Soft subtle orange glow */}
        <div className="absolute -top-32 right-1/4 h-[500px] w-[500px] rounded-full bg-gradient-to-bl from-[#FF6600]/10 via-[#FF6600]/5 to-transparent blur-[140px]" />
      </div>

      {/* ── Fixed Pinned Top Bar (Stays up on scroll) ── */}
      <header className="fixed top-0 inset-x-0 z-50 bg-[#14161B]/90 backdrop-blur-md border-b border-[#252932]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center bg-[#FF6600] text-white font-display font-black text-base shadow-[0_0_12px_rgba(255,102,0,0.4)]">
              S
            </div>
            <div className="flex flex-col">
              <span className="font-display text-sm font-bold tracking-[0.2em] text-white flex items-center gap-1.5">
                SAGAR <span className="text-[10px] text-[#FF6600] font-normal">// DEFENSE</span>
              </span>
              <span className="text-[9px] font-mono tracking-widest text-[#6B7280]">
                SAR-AIS INTELLIGENCE PLATFORM
              </span>
            </div>
          </div>

          {/* Quick Nav Links */}
          <div className="hidden lg:flex items-center gap-6 font-mono text-xs tracking-wider text-[#A2A8B5]">
            <a href="#radar-physics" className="hover:text-[#FF6600] transition-colors">
              // 01. SAR PHYSICS
            </a>
            <a href="#submersion" className="hover:text-[#FF6600] transition-colors">
              // 02. FLUID TANK
            </a>
            <a href="#neural-model" className="hover:text-[#FF6600] transition-colors">
              // 03. NEURAL AI
            </a>
            <a href="#drift-model" className="hover:text-[#FF6600] transition-colors">
              // 04. HYDRODYNAMICS
            </a>
            <a href="#team" className="hover:text-[#FF6600] transition-colors">
              // 05. TEAM
            </a>
          </div>

          <div className="flex items-center gap-3">
            {/* Theme / Contrast Toggle */}
            <button
              onClick={() => setThemeMode((m) => (m === 'dark' ? 'contrast' : 'dark'))}
              className="p-2 border border-[#2D323E] bg-[#1B1E25] text-[#A2A8B5] hover:text-white hover:border-[#FF6600]/40 transition-colors"
              title="Toggle Theme Contrast"
              aria-label="Toggle Theme Contrast"
            >
              {themeMode === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            </button>

            {/* Launch Console Button */}
            <button
              onClick={onEnter}
              className="group flex items-center gap-2 bg-[#FF6600] px-5 py-2 font-display text-xs font-bold tracking-wider text-white shadow-[0_4px_14px_rgba(255,102,0,0.35)] transition-all duration-300 hover:bg-[#E05500] cursor-pointer active:scale-95"
            >
              <span>LAUNCH CONSOLE</span>
              <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
            </button>
          </div>
        </div>
      </header>

      {/* ── Section 1: Hero with Sailing Ship & Intro Animation ── */}
      <section className="relative z-10 mx-auto max-w-7xl px-4 pt-32 pb-20 sm:px-6 lg:pt-36 lg:pb-28 text-center flex flex-col items-center">
        {/* Sailing Ship with Billowing Flowing Smoke */}
        <motion.div
          initial={{ x: -140, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
          className="mb-4 w-44 sm:w-56"
        >
          <SailingShipSVG className="w-full h-auto drop-shadow-md" />
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="font-display text-6xl sm:text-7xl lg:text-9xl font-black tracking-tight text-white leading-none mb-4"
        >
          <span className="text-[#FF6600]">S</span>AGAR
        </motion.h1>

        {/* Technical Sub-badge */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="inline-flex items-center gap-2 border border-[#2D323E] bg-[#1B1E25] px-3.5 py-1.5 font-mono text-xs tracking-widest text-[#FF6600] mb-6"
        >
          <span>COPERNICUS SENTINEL-1 SAR · REVERSE-DRIFT · AIS FORENSICS</span>
        </motion.div>

        {/* Narrative Description */}
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.7 }}
          className="max-w-3xl text-base sm:text-lg text-[#A2A8B5] leading-relaxed font-sans mb-10"
        >
          Autonomous satellite reconnaissance correlating spaceborne Synthetic Aperture Radar,
          YOLOv8 instance segmentation, and hydrodynamic reverse-drift backtracking with PostGIS
          AIS transponder archives to attribute illegal maritime bilge dumping.
        </motion.p>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.9 }}
          className="flex flex-wrap items-center justify-center gap-4"
        >
          <button
            onClick={onEnter}
            className="flex items-center gap-3 bg-[#FF6600] px-8 py-3.5 font-display text-sm font-bold tracking-wider text-white shadow-[0_6px_20px_rgba(255,102,0,0.4)] transition-all duration-300 hover:bg-[#E05500] cursor-pointer active:scale-95"
          >
            <span>INVESTIGATE ACTIVE SPILLS</span>
            <ArrowRight size={16} />
          </button>

          <a
            href="#radar-physics"
            className="flex items-center gap-2 border border-[#2D323E] bg-[#1B1E25] px-6 py-3.5 font-display text-sm font-semibold tracking-wider text-white transition-all duration-300 hover:border-[#FF6600]/50 hover:bg-[#222630]"
          >
            <span>EXPLORE ARCHITECTURE</span>
            <ChevronDown size={16} />
          </a>
        </motion.div>

        {/* Live Status Strip */}
        <div className="mt-14 flex flex-wrap items-center justify-center gap-6 font-mono text-xs text-[#6B7280] border-t border-[#252932] pt-6">
          <div className="flex items-center gap-2">
            <span className="text-[#FF6600] font-bold">SENSOR:</span>
            <span>Sentinel-1 C-Band (5.405 GHz)</span>
          </div>
          <span>·</span>
          <div className="flex items-center gap-2">
            <span className="text-emerald-400 font-bold">INFERENCE:</span>
            <span>1.2 ms (RTX 4060 GPU)</span>
          </div>
          <span>·</span>
          <div className="flex items-center gap-2">
            <span className="text-cyan-400 font-bold">HINDCAST:</span>
            <span>12h ECMWF/HYCOM Wind-Leeway</span>
          </div>
        </div>
      </section>

      {/* ── Section 2: Submersion Incubator Tank (No Meta Text) ── */}
      <section
        id="submersion"
        ref={aquariumSectionRef}
        className="relative z-10 py-20 lg:py-28 border-t border-[#252932] bg-[#14161B]"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Left Radar Telemetry Card */}
            <div className="lg:col-span-3 space-y-4">
              <div className="glass-specimen p-5 border border-[#2D323E]">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-[10px] text-[#6B7280]">RADAR BACKSCATTER</span>
                  <span className="h-1.5 w-1.5 rounded-full bg-[#FF6600]" />
                </div>
                <div className="font-display text-3xl font-black text-white">-14.2 dB</div>
                <p className="font-mono text-xs text-[#A2A8B5] mt-1 leading-relaxed">
                  Surfactant film dampens ocean capillary waves, causing specular reflection away from the SAR antenna.
                </p>
              </div>

              <div className="glass-specimen p-5 border border-[#2D323E]">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-[10px] text-[#6B7280]">ANNUAL DISCHARGE</span>
                  <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                </div>
                <div className="font-display text-3xl font-black text-red-400">4.5M T</div>
                <p className="font-mono text-xs text-[#A2A8B5] mt-1 leading-relaxed">
                  Over 70% of maritime oil pollution originates from deliberate bilge dumping rather than tanker accidents.
                </p>
              </div>
            </div>

            {/* Center Aquarium Specimen Chamber */}
            <div className="lg:col-span-6 flex justify-center py-4">
              <AquariumChamber
                shipRotate={shipRotate}
                shipY={shipY}
                bubbleOpacity={bubbleOpacity}
              />
            </div>

            {/* Right Drift Telemetry Card */}
            <div className="lg:col-span-3 space-y-4">
              <div className="glass-specimen p-5 border border-[#2D323E]">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-[10px] text-[#6B7280]">LEEWAY DRIFT COUPLING</span>
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                </div>
                <div className="font-display text-3xl font-black text-cyan-400">3.0%</div>
                <p className="font-mono text-xs text-[#A2A8B5] mt-1 leading-relaxed">
                  Surface wind forcing leeway factor coupled with Eulerian ocean current velocity vectors.
                </p>
              </div>

              <div className="glass-specimen p-5 border border-[#2D323E]">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-[10px] text-[#6B7280]">AIS CORRELATION MATCH</span>
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                </div>
                <div className="font-display text-3xl font-black text-emerald-400">94.8%</div>
                <p className="font-mono text-xs text-[#A2A8B5] mt-1 leading-relaxed">
                  Top-ranked suspect vessel crossing reverse-drift origin coordinate with transponder blackout gap.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 3: Deep Technical Pillar 1 — Synthetic Aperture Radar (SAR) ── */}
      <section id="radar-physics" className="relative z-10 py-20 border-t border-[#252932] bg-[#181B22]/50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-6 space-y-4">
              <div className="inline-flex items-center gap-2 border border-[#2D323E] bg-[#1B1E25] px-3 py-1 font-mono text-[11px] text-[#FF6600]">
                <Satellite size={13} />
                <span>RADAR PHYSICS & SENSOR CALIBRATION</span>
              </div>
              <h2 className="font-display text-3xl sm:text-4xl font-bold text-white tracking-tight">
                SENTINEL-1 C-BAND SAR IMAGERY INGESTION
              </h2>
              <p className="text-sm text-[#A2A8B5] leading-relaxed font-sans">
                Copernicus Sentinel-1 carries an active C-band Synthetic Aperture Radar (5.405 GHz)
                capable of imaging the ocean day and night through dense cloud cover and monsoon storms.
              </p>
              <div className="space-y-3 font-mono text-xs text-[#A2A8B5] pt-2">
                <div className="p-3 bg-[#1B1E25] border border-[#2D323E] flex items-start gap-3">
                  <span className="text-[#FF6600] font-bold">01</span>
                  <div>
                    <strong className="text-white block font-sans">Bragg Wave Damping Physics:</strong>
                    Oil films exert surface tension that extinguishes short capillary gravity waves. The smooth water surface acts as a mirror, reflecting radar pulses away from the satellite antenna and producing dark signature patches.
                  </div>
                </div>
                <div className="p-3 bg-[#1B1E25] border border-[#2D323E] flex items-start gap-3">
                  <span className="text-[#FF6600] font-bold">02</span>
                  <div>
                    <strong className="text-white block font-sans">Speckle Reduction & Tiling:</strong>
                    Raw GRD backscatter is converted to normalized radar cross-section (Sigma0), filtered using 5x5 Lee Sigma speckle suppression, and tiled into 416x416 composite GeoTIFFs (VV, VH, and VV-VH difference bands).
                  </div>
                </div>
              </div>
            </div>

            {/* Radar Data Matrix Table */}
            <div className="lg:col-span-6 glass-specimen p-6 border border-[#2D323E]">
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#2D323E] font-mono text-xs text-[#6B7280]">
                <span>SENTINEL-1 TELEMETRY SPECIFICATION</span>
                <span className="text-[#FF6600]">ESA SNAP / pyroSAR</span>
              </div>
              <div className="grid grid-cols-2 gap-3 font-mono text-xs">
                <div className="p-3 bg-[#14161B] border border-[#2D323E]">
                  <span className="text-[#6B7280] block text-[10px]">RADAR FREQUENCY</span>
                  <span className="text-white font-bold">5.405 GHz (C-Band)</span>
                </div>
                <div className="p-3 bg-[#14161B] border border-[#2D323E]">
                  <span className="text-[#6B7280] block text-[10px]">POLARIZATION</span>
                  <span className="text-white font-bold">Dual-Pol (VV + VH)</span>
                </div>
                <div className="p-3 bg-[#14161B] border border-[#2D323E]">
                  <span className="text-[#6B7280] block text-[10px]">SPATIAL RESOLUTION</span>
                  <span className="text-white font-bold">10 Meters / Pixel</span>
                </div>
                <div className="p-3 bg-[#14161B] border border-[#2D323E]">
                  <span className="text-[#6B7280] block text-[10px]">TILE MATRIX</span>
                  <span className="text-white font-bold">416 × 416 Float32</span>
                </div>
                <div className="p-3 bg-[#14161B] border border-[#2D323E]">
                  <span className="text-[#6B7280] block text-[10px]">PROJECTION</span>
                  <span className="text-white font-bold">EPSG:4326 (WGS 84)</span>
                </div>
                <div className="p-3 bg-[#14161B] border border-[#2D323E]">
                  <span className="text-[#6B7280] block text-[10px]">SPECKLE FILTER</span>
                  <span className="text-white font-bold">Lee Sigma (7x7 window)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 4: Deep Technical Pillar 2 — YOLOv8-Seg & Computer Vision ── */}
      <section id="neural-model" className="relative z-10 py-20 border-t border-[#252932] bg-[#14161B]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            {/* Model Architecture Bento */}
            <div className="lg:col-span-6 order-2 lg:order-1 glass-specimen p-6 border border-[#2D323E]">
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#2D323E] font-mono text-xs text-[#6B7280]">
                <span>YOLOv8-SEG TRAINING BENCHMARKS</span>
                <span className="text-emerald-400">NVIDIA RTX 4060 GPU</span>
              </div>
              <div className="grid grid-cols-3 gap-3 font-mono text-center mb-4">
                <div className="p-3 bg-[#14161B] border border-[#2D323E]">
                  <div className="text-2xl font-bold text-[#FF6600]">0.529</div>
                  <div className="text-[10px] text-[#6B7280] mt-1">MASK mAP50</div>
                </div>
                <div className="p-3 bg-[#14161B] border border-[#2D323E]">
                  <div className="text-2xl font-bold text-emerald-400">0.650</div>
                  <div className="text-[10px] text-[#6B7280] mt-1">MASK PRECISION</div>
                </div>
                <div className="p-3 bg-[#14161B] border border-[#2D323E]">
                  <div className="text-2xl font-bold text-cyan-400">1.2 ms</div>
                  <div className="text-[10px] text-[#6B7280] mt-1">INFERENCE LATENCY</div>
                </div>
              </div>
              <div className="p-3 bg-[#14161B] border border-[#2D323E] font-mono text-xs space-y-1.5 text-[#A2A8B5]">
                <div className="text-white font-bold font-sans">Look-Alike False Positive Rejection:</div>
                <p className="text-[11px] leading-relaxed">
                  Low-wind zones (&lt;3 m/s), biogenic slicks, internal solitary waves, and upwelling also produce dark SAR patches. The network isolates continuous narrow discharge plumes via morphologic solidity (&gt;0.35) and compactness thresholds.
                </p>
              </div>
            </div>

            {/* Model Description */}
            <div className="lg:col-span-6 order-1 lg:order-2 space-y-4">
              <div className="inline-flex items-center gap-2 border border-[#2D323E] bg-[#1B1E25] px-3 py-1 font-mono text-[11px] text-[#FF6600]">
                <Cpu size={13} />
                <span>NEURAL INSTANCE SEGMENTATION</span>
              </div>
              <h2 className="font-display text-3xl sm:text-4xl font-bold text-white tracking-tight">
                AI DISCHARGE FOOTPRINT EXTRACTION
              </h2>
              <p className="text-sm text-[#A2A8B5] leading-relaxed font-sans">
                Trained on the CSIRO Sentinel-1 SAR Oil Slick dataset (5,538 satellite scenes).
                The network segments polygon boundaries with sub-pixel precision and transforms
                them via GeoTransform affine matrices into standard WGS84 GeoJSON.
              </p>
              <div className="grid grid-cols-2 gap-3 font-mono text-xs pt-2">
                <div className="p-3 bg-[#1B1E25] border border-[#2D323E]">
                  <span className="text-[#6B7280] block text-[10px]">TRAINING DATASET</span>
                  <span className="text-white font-bold">5,538 SAR Scenes (CSIRO)</span>
                </div>
                <div className="p-3 bg-[#1B1E25] border border-[#2D323E]">
                  <span className="text-[#6B7280] block text-[10px]">WEIGHT FOOTPRINT</span>
                  <span className="text-white font-bold">6.8 MB (YOLOv8n-seg)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 5: Deep Technical Pillar 3 & 4 — Hydrodynamics & AIS Attribution ── */}
      <section id="drift-model" className="relative z-10 py-20 border-t border-[#252932] bg-[#181B22]/50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Hydrodynamic Drift Card */}
            <div className="glass-specimen p-6 border border-[#2D323E] space-y-4">
              <div className="inline-flex items-center gap-2 border border-[#2D323E] bg-[#1B1E25] px-2.5 py-1 font-mono text-[10px] text-cyan-400">
                <Wind size={12} />
                <span>HYDRODYNAMIC BACKTRACK</span>
              </div>
              <h3 className="font-display text-2xl font-bold text-white">
                REVERSE-DRIFT ORIGIN PINPOINTING
              </h3>
              <p className="text-xs text-[#A2A8B5] leading-relaxed font-sans">
                Oil slicks drift under combined Eulerian surface currents and direct atmospheric wind leeway.
                The backtrack engine computes the discharge coordinate (X_origin) by reverse-integrating vectors:
              </p>
              <div className="p-3 bg-[#14161B] border border-[#2D323E] font-mono text-xs text-[#FF6600]">
                <code>V_oil(t) = V_current(t) + 0.03 · V_wind(t)</code>
              </div>
              <ul className="space-y-2 font-mono text-xs text-[#A2A8B5]">
                <li className="flex items-center gap-2">
                  <span className="h-1 w-1 bg-cyan-400" />
                  <span>Integrated with ECMWF Global Wind & HYCOM Ocean Currents</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1 w-1 bg-cyan-400" />
                  <span>12-hour backtrack trajectory with uncertainty boundary cone</span>
                </li>
              </ul>
            </div>

            {/* AIS Attribution Card */}
            <div className="glass-specimen p-6 border border-[#2D323E] space-y-4">
              <div className="inline-flex items-center gap-2 border border-[#2D323E] bg-[#1B1E25] px-2.5 py-1 font-mono text-[10px] text-[#FF6600]">
                <Target size={12} />
                <span>SPATIO-TEMPORAL FORENSICS</span>
              </div>
              <h3 className="font-display text-2xl font-bold text-white">
                POSTGIS AIS VESSEL CORRELATION
              </h3>
              <p className="text-xs text-[#A2A8B5] leading-relaxed font-sans">
                Correlates the reverse-drift origin coordinate against historical ship transponder feeds.
                Assigns an attribution suspicion score (0-100%) factoring:
              </p>
              <div className="space-y-2 font-mono text-xs text-[#A2A8B5]">
                <div className="p-2.5 bg-[#14161B] border border-[#2D323E] flex justify-between">
                  <span>Spatial Proximity (ST_DWithin)</span>
                  <span className="text-white font-bold">40% Weight</span>
                </div>
                <div className="p-2.5 bg-[#14161B] border border-[#2D323E] flex justify-between">
                  <span>Speed Anomaly (Slowing for dumping)</span>
                  <span className="text-white font-bold">25% Weight</span>
                </div>
                <div className="p-2.5 bg-[#14161B] border border-[#2D323E] flex justify-between">
                  <span>AIS Transponder Blackout Gaps</span>
                  <span className="text-white font-bold">35% Weight</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 6: Square Rubber-Band Stretchy Text (S A G A R) ── */}
      <section className="relative z-10 py-20 border-t border-[#252932] bg-[#14161B] text-center">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          {/* Square Modular Letters with 2.5s Persistence */}
          <div className="flex gap-2 sm:gap-4 justify-center items-center max-w-3xl mx-auto">
            {['S', 'A', 'G', 'A', 'R'].map((letter, i) => (
              <RubberBandLetter key={i} char={letter} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Section 7: Contributors & Engineering Team ── */}
      <section id="team" className="relative z-10 py-20 border-t border-[#252932] bg-[#181B22]/60">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <span className="font-mono text-xs tracking-[0.2em] text-[#FF6600] uppercase block mb-2">
              Contributors & Research Team
            </span>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-white tracking-tight">
              ENGINEERING TEAM // SIH 26143
            </h2>
            <p className="text-xs sm:text-sm text-[#A2A8B5] mt-2 font-sans">
              Developed for the Smart India Hackathon: autonomous maritime reconnaissance and environmental enforcement.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                role: 'AI & COMPUTER VISION LEAD',
                focus: 'YOLOv8-Seg fine-tuning, mAP50 evaluation, Affine GeoJSON vectorization pipeline.',
                github: 'https://github.com',
                tag: 'DEV 2',
              },
              {
                role: 'GEOSPATIAL & SAR PIPELINE LEAD',
                focus: 'Sentinel-1 GRD calibration, Lee Sigma speckle filtering, 416x416 GeoTIFF tiling.',
                github: 'https://github.com',
                tag: 'DEV 1',
              },
              {
                role: 'HYDRODYNAMICS & BACKEND ARCHITECT',
                focus: 'FastAPI service, reverse-drift leeway modeling, HYCOM current vector integration.',
                github: 'https://github.com',
                tag: 'BACKEND',
              },
              {
                role: 'FULLSTACK & SYSTEMS LEAD',
                focus: 'PostGIS AIS spatio-temporal forensics, Leaflet radar UI & PDF legal dossier compiler.',
                github: 'https://github.com',
                tag: 'FULLSTACK',
              },
            ].map((member, i) => (
              <div
                key={i}
                className="glass-specimen p-6 border border-[#2D323E] flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-mono text-[10px] px-2 py-0.5 bg-[#14161B] text-[#FF6600] border border-[#2D323E]">
                      {member.tag}
                    </span>
                    <span className="font-mono text-xs text-[#6B7280]">0{i + 1}</span>
                  </div>
                  <h3 className="font-display text-sm font-bold text-white tracking-wide mb-2">
                    {member.role}
                  </h3>
                  <p className="text-xs text-[#A2A8B5] leading-relaxed font-sans mb-6">
                    {member.focus}
                  </p>
                </div>

                <a
                  href={member.github}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 border border-[#2D323E] bg-[#14161B] px-4 py-2 font-mono text-xs text-[#A2A8B5] hover:text-white hover:border-[#FF6600]/40 transition-colors"
                >
                  <Github size={13} />
                  <span>GitHub Profile</span>
                  <ExternalLink size={11} className="opacity-60" />
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Section 8: Mission Control Launch CTA Banner ── */}
      <section className="relative z-10 py-20 border-t border-[#252932] bg-[#14161B] text-center">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <div className="glass-specimen p-10 sm:p-14 border border-[#FF6600]/30 shadow-[0_0_50px_rgba(255,102,0,0.12)] relative overflow-hidden">
            <div className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-[#FF6600]/20 blur-3xl" />

            <h2 className="font-display text-3xl sm:text-5xl font-black text-white tracking-tight mb-4">
              READY TO INVESTIGATE ACTIVE SPILLS?
            </h2>
            <p className="max-w-2xl mx-auto text-sm sm:text-base text-[#A2A8B5] leading-relaxed font-sans mb-8">
              Access the live Leaflet map console, inspect glowing red slick polygons, evaluate suspect
              vessel leaderboards, and generate legal maritime enforcement dossiers.
            </p>

            <button
              onClick={onEnter}
              className="group inline-flex items-center gap-3 bg-[#FF6600] px-10 py-4 font-display text-base font-bold tracking-wider text-white shadow-[0_6px_25px_rgba(255,102,0,0.4)] transition-all duration-300 hover:bg-[#E05500] cursor-pointer active:scale-95"
            >
              <span>ENTER MISSION CONTROL CONSOLE</span>
              <ArrowRight size={18} className="transition-transform group-hover:translate-x-1.5" />
            </button>
          </div>
        </div>
      </section>

      {/* ── Technical Footer ── */}
      <footer className="relative z-10 border-t border-[#252932] py-8 font-mono text-xs text-[#6B7280]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            SAGAR PLATFORM // SMART INDIA HACKATHON 2026
          </div>
          <div className="flex items-center gap-4 text-[10px]">
            <span>EPSG:4326 WGS84</span>
            <span>·</span>
            <span>C-BAND SAR</span>
            <span>·</span>
            <span>POSTGIS AIS</span>
            <span>·</span>
            <span>YOLOV8-SEG</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
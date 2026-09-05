import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Anchor, ArrowRight, CheckCircle2, Radar, Satellite, Waves } from 'lucide-react';
import AmbientBackground from './AmbientBackground';
import LandingGlobe from './LandingGlobe';

interface StartupScreenProps { onComplete: () => void; }

const LOADING_STEPS = ['WAKING SATELLITE INTELLIGENCE', 'SYNCING SAR SCENES', 'CORRELATING MARITIME SIGNALS', 'PREPARING ANALYSIS CONSOLE'];

export default function StartupScreen({ onComplete }: StartupScreenProps) {
  const [entering, setEntering] = useState(false);
  const [progress, setProgress] = useState(0);

  const enter = () => {
    if (entering) return;
    setEntering(true);
    let value = 0;
    const timer = window.setInterval(() => {
      value += 1;
      setProgress(value);
      if (value >= 100) {
        window.clearInterval(timer);
        window.setTimeout(onComplete, 350);
      }
    }, 18);
  };

  return (
    <AnimatePresence>
      <motion.div className="fixed inset-0 z-[200] overflow-hidden bg-[#05080d]" exit={{ opacity: 0 }} transition={{ duration: 0.5 }}>
        <AmbientBackground />
        <div className="absolute inset-0 z-[1] opacity-95"><LandingGlobe /></div>
        <motion.div className="sagar-moon" animate={{ opacity: [0.55, 0.85, 0.55], scale: [1, 1.04, 1] }} transition={{ duration: 5, repeat: Infinity }} />

        <motion.div className="absolute inset-x-0 top-[8%] z-20 mx-auto max-w-5xl px-6 text-center" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
          <div className="mb-5 font-mono-tech text-[11px] tracking-[0.35em] text-accent-cyan/80">MARITIME INTELLIGENCE</div>
          <div className="mb-4 flex items-center justify-center gap-3">
            <Anchor size={34} className="text-accent-cyan drop-shadow-[0_0_18px_rgba(242,140,40,0.6)]" />
            <h1 className="font-mono-tech text-5xl font-semibold tracking-[0.22em] text-text-primary sm:text-7xl">SAGAR</h1>
          </div>
          <p className="mx-auto max-w-3xl text-sm leading-7 text-text-secondary sm:text-base">
            <span className="font-semibold text-accent-orange">SAR-based Automated Geospatial Analysis for Recognition of oil spills</span>
          </p>
        </motion.div>



        <div className="absolute bottom-0 left-0 right-0 z-10 h-[40%] bg-[linear-gradient(180deg,rgba(7,18,28,0.08),rgba(3,12,19,0.95))]" />
        <div className="absolute inset-x-0 bottom-[24%] z-20 mx-auto flex max-w-4xl justify-center gap-3 px-6 text-[10px] sm:gap-6 sm:text-xs">
          {[['SAR', Satellite], ['AIS', Radar], ['DRIFT', Waves]].map(([label, Icon]) => {
            const C = Icon as typeof Satellite;
            return <div key={label as string} className="glass-subtle flex items-center gap-2 rounded-full px-3 py-2 font-mono-tech tracking-widest text-text-secondary"><C size={13} className="text-accent-cyan" />{label as string}<span className="h-1.5 w-1.5 rounded-full bg-accent-green shadow-[0_0_8px_rgba(61,232,136,0.9)]" /></div>;
          })}
        </div>

        <div className="absolute inset-x-0 bottom-10 z-30 mx-auto flex flex-col items-center px-6">
          {!entering ? (
            <motion.button onClick={enter} whileHover={{ scale: 1.04, boxShadow: '0 0 34px rgba(242,140,40,0.32)' }} whileTap={{ scale: 0.97 }} className="group relative overflow-hidden rounded-full border border-accent-cyan/50 bg-accent-cyan/10 px-9 py-3 font-mono-tech text-sm font-semibold tracking-[0.22em] text-accent-cyan backdrop-blur-xl">
              <span className="relative z-10 flex items-center gap-3">ENTER <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" /></span>
            </motion.button>
          ) : (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-strong w-full max-w-md rounded-xl p-5 text-center">
              <div className="mb-3 flex items-center justify-between font-mono-tech text-[11px] tracking-widest text-text-secondary"><span>{LOADING_STEPS[Math.min(LOADING_STEPS.length - 1, Math.floor(progress / 25))]}</span><span className="text-accent-cyan">{progress}%</span></div>
              <div className="h-1.5 overflow-hidden rounded-full bg-bg-raised"><motion.div className="h-full bg-gradient-to-r from-accent-cyan/50 via-accent-cyan to-white/80" animate={{ width: `${progress}%` }} /></div>
              {progress >= 100 && <div className="mt-3 flex items-center justify-center gap-2 font-mono-tech text-[11px] tracking-widest text-accent-green"><CheckCircle2 size={14} /> CONSOLE READY</div>}
            </motion.div>
          )}
          <div className="mt-5 font-mono-tech text-[10px] tracking-[0.25em] text-text-muted">OCEANIC DOMAIN • SAR INTELLIGENCE • OIL SPILL RECOGNITION</div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

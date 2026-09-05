import React from 'react';
import { motion } from 'framer-motion';

const LandingPage = ({ onEnter }: { onEnter: () => void }) => {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-gradient-to-b from-slate-900 via-blue-950 to-slate-900 text-white overflow-hidden p-6">
      
      {/* Background Subtle Wave Animations */}
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-cyan-500/10 via-transparent to-transparent animate-pulse" />
      </div>

      {/* Hero Header */}
      <div className="mt-12 text-center max-w-4xl z-10">
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight bg-gradient-to-r from-cyan-400 via-blue-300 to-teal-400 bg-clip-text text-transparent mb-4">
          SAGAR
        </h1>
        <p className="text-lg md:text-2xl text-cyan-100/80 font-medium tracking-wide">
          SAR-based Automated Geospatial Analysis for Recognition of oil spills
        </p>
      </div>

      {/* Sailing Ship Animation */}
      <div className="relative w-full h-48 flex items-center justify-center my-auto">
        {/* Ocean Line */}
        <div className="absolute w-full h-1 bg-cyan-500/30 bottom-10" />
        
        {/* Animated Ship */}
        <motion.div
          className="absolute left-0 bottom-8 text-cyan-300 flex flex-col items-center"
          animate={{ x: ['-10vw', '100vw'] }}
          transition={{
            duration: 18,
            repeat: Infinity,
            ease: 'linear',
          }}
        >
          {/* SVG Ship Icon */}
          <svg
            className="w-16 h-16 md:w-20 md:h-20 drop-shadow-[0_4px_8px_rgba(6,182,212,0.5)]"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M20 21c-1.39 0-2.78-.47-4-1.32-2.44 1.71-5.56 1.71-8 0C6.78 20.53 5.39 21 4 21H2v2h2c1.38 0 2.74-.35 4-.99 2.52 1.29 5.48 1.29 8 0 1.26.64 2.62.99 4 .99h2v-2h-2zM3.95 19H4c1.1 0 2.19-.34 3.16-.98.11-.07.23-.07.34 0 1.95 1.29 4.38 1.29 6.33 0 .11-.07.23-.07.34 0 .97.64 2.06.98 3.16.98h.05l1.9-5.71C17.5 12.18 15.01 11 12 11s-5.5 1.18-7.28 2.29L3.95 19zM12 1L8 8h8l-4-7z" />
          </svg>
          {/* Ocean Wake */}
          <div className="w-12 h-1 bg-cyan-400/40 rounded-full blur-xs mt-1 animate-pulse" />
        </motion.div>
      </div>

      {/* Action / Enter Button */}
      <div className="mb-12 z-10">
        <button
          onClick={onEnter}
          className="px-8 py-3 text-lg font-semibold text-slate-900 bg-cyan-400 hover:bg-cyan-300 rounded-full shadow-[0_0_20px_rgba(34,211,238,0.4)] transition-all duration-300 transform hover:scale-105 active:scale-95 cursor-pointer"
        >
          Enter Platform
        </button>
      </div>
    </div>
  );
};

export default LandingPage;
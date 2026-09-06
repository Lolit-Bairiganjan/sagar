import { motion } from 'framer-motion';

/** A self-contained, texture-like Earth that does not depend on a remote image. */
export default function RealisticEarth() {
  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-hidden pointer-events-none">
      <div className="absolute h-[62vmin] w-[62vmin] min-h-[420px] min-w-[420px] max-h-[760px] max-w-[760px] rounded-full bg-[radial-gradient(circle_at_30%_25%,rgba(255,255,255,.28),transparent_12%),radial-gradient(circle_at_18%_40%,#3a9868_0%,#1f6f50_16%,transparent_31%),radial-gradient(circle_at_66%_28%,#6aa744_0%,#2b713e_15%,transparent_29%),radial-gradient(circle_at_55%_68%,#c8a95e_0%,#7a6d3b_12%,transparent_28%),radial-gradient(circle_at_50%_50%,#1267a5_0%,#0c4f83_42%,#062946_72%,#010a14_100%)] shadow-[inset_-70px_-35px_80px_rgba(0,0,0,.85),inset_28px_20px_60px_rgba(125,215,255,.22),0_0_55px_rgba(62,173,255,.32),0_0_130px_rgba(18,103,185,.18)]">
        <motion.div
          className="absolute inset-0 rounded-full opacity-80 mix-blend-overlay"
          style={{ backgroundImage: 'repeating-radial-gradient(circle at 45% 50%, rgba(255,255,255,.08) 0 1px, transparent 2px 7px), repeating-linear-gradient(115deg, transparent 0 14px, rgba(16,63,55,.18) 15px 18px, transparent 19px 38px)' }}
          animate={{ rotate: 360 }}
          transition={{ duration: 45, repeat: Infinity, ease: 'linear' }}
        />
        <motion.div
          className="absolute -inset-[8%] rounded-full opacity-35 blur-[1px]"
          style={{ backgroundImage: 'radial-gradient(ellipse at 25% 32%, rgba(255,255,255,.75) 0 2%, transparent 8%), radial-gradient(ellipse at 60% 42%, rgba(255,255,255,.65) 0 2%, transparent 9%), radial-gradient(ellipse at 43% 70%, rgba(255,255,255,.45) 0 2%, transparent 8%)' }}
          animate={{ rotate: -360 }}
          transition={{ duration: 70, repeat: Infinity, ease: 'linear' }}
        />
        <div className="absolute inset-[-2%] rounded-full border border-cyan-200/20 shadow-[0_0_30px_rgba(92,196,255,.25)]" />
      </div>
    </div>
  );
}

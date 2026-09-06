import { useState } from 'react';
import { motion } from 'framer-motion';
import { FileText, Loader2, Check } from 'lucide-react';
import { generateEvidenceDossier } from '../utils/pdfGenerator';
import { soundEngine } from '../utils/soundEngine';
import type { Spill, Vessel } from '../types';

interface DossierButtonProps {
  spill: Spill | null;
  vessel: Vessel | null;
}

export default function DossierButton({ spill, vessel }: DossierButtonProps) {
  const [state, setState] = useState<'idle' | 'generating' | 'done'>('idle');

  const handleClick = async () => {
    if (state === 'generating') return;
    soundEngine.playBubbleHover();
    setState('generating');
    // Small delay so the "generating" state is perceptible for an otherwise instant client-side op.
    await new Promise((r) => setTimeout(r, 550));
    try {
      generateEvidenceDossier(spill, vessel);
      setState('done');
      setTimeout(() => setState('idle'), 1800);
    } catch {
      setState('idle');
    }
  };

  return (
    <motion.button
      onClick={handleClick}
      onMouseEnter={() => soundEngine.playBubbleHover()}
      disabled={!spill || !vessel || state === 'generating'}
      whileHover={{ scale: 1.015 }}
      whileTap={{ scale: 0.97 }}
      className="flex w-full items-center justify-center gap-2 border border-[#FF6600] bg-[#FF6600] py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-white shadow-[0_2px_12px_rgba(255,102,0,0.3)] transition-all hover:bg-[#E05500] cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 select-none"
    >
      {state === 'generating' && <Loader2 size={13} className="animate-spin text-white" />}
      {state === 'done' && <Check size={13} className="text-white" />}
      {state === 'idle' && <FileText size={13} className="text-white" />}
      {state === 'generating' ? 'Compiling Dossier…' : state === 'done' ? 'Dossier Saved' : 'Generate Evidence Dossier'}
    </motion.button>
  );
}

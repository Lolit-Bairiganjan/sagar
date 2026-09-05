import { useState } from 'react';
import { motion } from 'framer-motion';
import { FileText, Loader2, Check } from 'lucide-react';
import { generateEvidenceDossier } from '../utils/pdfGenerator';
import type { Spill, Vessel } from '../types';

interface DossierButtonProps {
  spill: Spill | null;
  vessel: Vessel | null;
}

export default function DossierButton({ spill, vessel }: DossierButtonProps) {
  const [state, setState] = useState<'idle' | 'generating' | 'done'>('idle');

  const handleClick = async () => {
    if (state === 'generating') return;
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
      disabled={!spill || !vessel || state === 'generating'}
      whileHover={{ scale: 1.015, rotateX: -3 }}
      whileTap={{ scale: 0.97, rotateX: 4 }}
      style={{ transformPerspective: 500 }}
      className="glass-cyan flex w-full items-center justify-center gap-2 rounded py-2.5 font-mono-tech text-[13px] font-semibold uppercase tracking-widest text-accent-cyan shadow-glassCyan transition-colors hover:bg-accent-cyan/10 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {state === 'generating' && <Loader2 size={13} className="animate-spin" />}
      {state === 'done' && <Check size={13} />}
      {state === 'idle' && <FileText size={13} />}
      {state === 'generating' ? 'Compiling Dossier…' : state === 'done' ? 'Dossier Saved' : 'Generate Evidence Dossier'}
    </motion.button>
  );
}

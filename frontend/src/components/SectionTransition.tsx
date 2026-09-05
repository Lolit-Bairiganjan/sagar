import { AnimatePresence, motion } from 'framer-motion';
import type { ReactNode } from 'react';

interface SectionTransitionProps {
  sectionKey: string;
  children: ReactNode;
  className?: string;
}

/**
 * Wraps section content with a 3D perspective flip/rotate animation that plays
 * whenever `sectionKey` changes (e.g. switching nav sections). Uses a real
 * CSS 3D transform (rotateY + depth translate) rather than a flat fade/slide.
 */
export default function SectionTransition({ sectionKey, children, className }: SectionTransitionProps) {
  return (
    <div className={`perspective h-full w-full ${className ?? ''}`}>
      <AnimatePresence mode="wait">
        <motion.div
          key={sectionKey}
          className="preserve-3d h-full w-full"
          initial={{ opacity: 0, rotateY: -10, rotateX: 3, z: -120, scale: 0.97 }}
          animate={{ opacity: 1, rotateY: 0, rotateX: 0, z: 0, scale: 1 }}
          exit={{ opacity: 0, rotateY: 10, rotateX: -3, z: -120, scale: 0.97 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          style={{ transformOrigin: 'center' }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

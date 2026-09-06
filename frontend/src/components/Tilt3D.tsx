import { useRef } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import type { ReactNode } from 'react';

interface Tilt3DProps {
  children: ReactNode;
  className?: string;
  maxTilt?: number;
  glare?: boolean;
  scaleOnHover?: number;
}

/**
 * Wraps children in a card that tilts in 3D space toward the cursor,
 * with an optional glass "glare" sheen sweeping across it.
 */
export default function Tilt3D({
  children,
  className,
  maxTilt = 8,
  glare = true,
  scaleOnHover = 1.015,
}: Tilt3DProps) {
  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.5);

  const rotateX = useSpring(useTransform(my, [0, 1], [maxTilt, -maxTilt]), {
    stiffness: 220,
    damping: 18,
  });
  const rotateY = useSpring(useTransform(mx, [0, 1], [-maxTilt, maxTilt]), {
    stiffness: 220,
    damping: 18,
  });
  const glareX = useTransform(mx, [0, 1], ['-20%', '120%']);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    mx.set((e.clientX - rect.left) / rect.width);
    my.set((e.clientY - rect.top) / rect.height);
  };

  const handleMouseLeave = () => {
    mx.set(0.5);
    my.set(0.5);
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      whileHover={{ scale: scaleOnHover }}
      whileTap={{ scale: 0.985 }}
      style={{ rotateX, rotateY, transformPerspective: 800 }}
      className={`relative preserve-3d ${className ?? ''}`}
    >
      {children}
      {glare && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]"
          style={{ opacity: 0 }}
          whileHover={{ opacity: 1 }}
        >
          <motion.div
            className="absolute -top-1/2 h-[200%] w-1/3 bg-gradient-to-r from-transparent via-white/10 to-transparent"
            style={{ left: glareX }}
          />
        </motion.div>
      )}
    </motion.div>
  );
}

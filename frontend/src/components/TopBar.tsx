import { formatIndianTime } from '../utils/time';
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { createPortal } from 'react-dom';
import {
  Satellite,
  Radio,
  CloudSun,
  Settings,
  UserCircle2,
  X,
  Bell,
  RefreshCw,
  Ruler,
  Map as MapIcon,
  LogOut,
  Lock,
  Mail,
  CheckCircle2,
} from 'lucide-react';
import type { Investigation, SystemStatus } from '../types';

interface TopBarProps {
  investigation: Investigation | null;
  systemStatus: SystemStatus | null;
}

function useIndianClock() {
  const [time, setTime] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return formatIndianTime(time);
}

function StatusChip({
  icon: Icon,
  label,
  active,
}: {
  icon: React.ElementType;
  label: string;
  active: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5 font-mono-tech text-[13px] text-text-secondary">
      <Icon size={13} className={active ? 'text-accent-green' : 'text-text-muted'} />
      <span className="hidden lg:inline">{label}</span>
      <span
        className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-accent-green shadow-[0_0_6px_rgba(61,232,136,0.8)]' : 'bg-text-muted'}`}
      />
    </div>
  );
}

/** Small on/off switch used inside the Settings panel. */
function ToggleRow({
  icon: Icon,
  label,
  checked,
  onChange,
}: {
  icon: React.ElementType;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 rounded px-2 py-1.5 text-left transition-colors hover:bg-white/5"
    >
      <span className="flex items-center gap-2 font-mono-tech text-[12px] text-text-secondary">
        <Icon size={13} className="text-text-muted" />
        {label}
      </span>
      <span
        className={`relative h-4 w-7 shrink-0 rounded-full transition-colors ${
          checked ? 'bg-accent-cyan/60' : 'bg-white/10'
        }`}
      >
        <span
          className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-transform ${
            checked ? 'translate-x-3.5' : 'translate-x-0.5'
          }`}
        />
      </span>
    </button>
  );
}

function SettingsPanel({ onClose }: { onClose: () => void }) {
  const [notifications, setNotifications] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [imperialUnits, setImperialUnits] = useState(false);
  const [satelliteBasemap, setSatelliteBasemap] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  return (
    <motion.div
      ref={panelRef}
      initial={{ opacity: 0, y: -8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
      className="glass-strong absolute right-0 top-11 z-50 w-64 rounded-lg p-2 shadow-glass"
    >
      <div className="mb-1 flex items-center justify-between px-2 py-1">
        <span className="label-eyebrow">Settings</span>
        <button onClick={onClose} className="text-text-muted transition-colors hover:text-accent-cyan">
          <X size={14} />
        </button>
      </div>
      <div className="space-y-0.5">
        <ToggleRow icon={Bell} label="Notifications" checked={notifications} onChange={setNotifications} />
        <ToggleRow icon={RefreshCw} label="Auto-refresh feed" checked={autoRefresh} onChange={setAutoRefresh} />
        <ToggleRow icon={Ruler} label="Imperial units" checked={imperialUnits} onChange={setImperialUnits} />
        <ToggleRow icon={MapIcon} label="Satellite basemap" checked={satelliteBasemap} onChange={setSatelliteBasemap} />
      </div>
    </motion.div>
  );
}

function LoginModal({
  onClose,
  onSignedIn,
}: {
  onClose: () => void;
  onSignedIn: (email: string) => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('Enter an email and password to continue.');
      return;
    }
    // Demo/frontend-only auth: no backend call, just simulate a session.
    onSignedIn(email.trim());
  }

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.96 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        className="glass-strong relative w-full max-w-sm rounded-lg p-6 shadow-glass"
      >
        <button
          onClick={onClose}
          className="absolute right-3 top-3 rounded p-1 text-text-muted transition-colors hover:bg-white/5 hover:text-accent-cyan"
          aria-label="Close"
        >
          <X size={16} />
        </button>

        <div className="mb-5 flex flex-col items-center gap-2 text-center">
          <UserCircle2 size={30} className="text-accent-cyan" />
          <div className="font-mono-tech text-sm font-semibold tracking-[0.1em] text-text-primary">
            SIGN IN TO SAGAR
          </div>
          <div className="label-eyebrow">Operator authentication required</div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="label-eyebrow mb-1 block">Email</label>
            <div className="flex items-center gap-2 rounded border border-border bg-bg-raised/60 px-3 py-2 focus-within:border-accent-cyan/50">
              <Mail size={14} className="shrink-0 text-text-muted" />
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="operator@sagar.io"
                className="w-full bg-transparent font-mono-tech text-[13px] text-text-primary placeholder:text-text-muted focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="label-eyebrow mb-1 block">Password</label>
            <div className="flex items-center gap-2 rounded border border-border bg-bg-raised/60 px-3 py-2 focus-within:border-accent-cyan/50">
              <Lock size={14} className="shrink-0 text-text-muted" />
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-transparent font-mono-tech text-[13px] text-text-primary placeholder:text-text-muted focus:outline-none"
              />
            </div>
          </div>

          {error && <div className="font-mono-tech text-[12px] text-accent-red">{error}</div>}

          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            className="mt-1 w-full rounded border border-accent-cyan/40 bg-accent-cyan/10 py-2 font-mono-tech text-[12px] font-semibold tracking-widest text-accent-cyan transition-colors hover:bg-accent-cyan/20"
          >
            SIGN IN
          </motion.button>

          <button
            type="button"
            onClick={() => onSignedIn('guest@sagar.io')}
            className="w-full text-center font-mono-tech text-[11px] text-text-muted transition-colors hover:text-text-secondary"
          >
            Continue as guest
          </button>
        </form>
      </motion.div>
    </motion.div>,
    document.body,
  );
}

export default function TopBar({ investigation, systemStatus }: TopBarProps) {
  const indianTime = useIndianClock();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <header className="glass-strong relative z-30 flex h-14 shrink-0 items-center justify-between rounded-none border-x-0 border-t-0 px-4">
      {/* Left: identity */}
      <div className="flex min-w-0 items-center gap-3">
        <svg width="26" height="26" viewBox="0 0 32 32" className="shrink-0 text-accent-cyan">
          <circle cx="16" cy="16" r="10" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="16" cy="16" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.6" />
          <circle cx="16" cy="16" r="1.8" fill="currentColor" />
        </svg>
        <div className="min-w-0 leading-tight">
          <div className="font-mono-tech text-sm font-semibold tracking-[0.15em] text-text-primary">
            SAGAR
          </div>
          <div className="label-eyebrow truncate">
            <span className="text-accent-orange">SAR-based Automated Geospatial Analysis for Recognition of oil spills</span>
          </div>
        </div>
        <div className="ml-2 hidden items-center gap-1.5 border-l border-border pl-3 sm:flex">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-green shadow-[0_0_6px_rgba(61,232,136,0.8)]" />
          <span className="font-mono-tech text-micro uppercase tracking-widest text-accent-green">
            System Online
          </span>
        </div>
      </div>

      {/* Center: operation */}
      <div className="hidden flex-col items-center leading-tight md:flex">
        <div className="font-mono-tech text-xs font-semibold tracking-widest text-text-primary">
          {investigation?.operationName ?? 'OPERATION: BLUE HORIZON'}
        </div>
        <div className="label-eyebrow">{investigation?.sector ?? 'ARABIAN SEA / SECTOR 07'}</div>
      </div>

      {/* Right: status + controls */}
      <div className="flex items-center gap-4">
        <div className="hidden items-center gap-4 border-r border-border pr-4 xl:flex">
          <StatusChip icon={Satellite} label="SAT" active={systemStatus?.satellite !== 'OFFLINE'} />
          <StatusChip icon={Radio} label="AIS" active={systemStatus?.ais !== 'OFFLINE'} />
          <StatusChip icon={CloudSun} label="WX" active={systemStatus?.weather !== 'OFFLINE'} />
        </div>
        <span className="font-mono-tech text-xs tabular-nums text-text-secondary">{indianTime}</span>

        {/* Settings */}
        <div className="relative">
          <motion.button
            whileHover={{ rotateZ: 45, scale: 1.08 }}
            whileTap={{ scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 300, damping: 15 }}
            onClick={() => setSettingsOpen((v) => !v)}
            className={`rounded p-1.5 transition-colors hover:bg-white/5 hover:text-accent-cyan ${
              settingsOpen ? 'bg-white/5 text-accent-cyan' : 'text-text-secondary'
            }`}
            aria-label="Settings"
          >
            <Settings size={16} />
          </motion.button>
          <AnimatePresence>
            {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
          </AnimatePresence>
        </div>

        {/* User */}
        <div className="relative" ref={userMenuRef}>
          <motion.button
            whileHover={{ scale: 1.1, rotateY: 15 }}
            whileTap={{ scale: 0.92 }}
            transition={{ type: 'spring', stiffness: 300, damping: 15 }}
            onClick={() => {
              if (userEmail) {
                setUserMenuOpen((v) => !v);
              } else {
                setLoginOpen(true);
              }
            }}
            className={`flex items-center gap-1.5 rounded p-1.5 transition-colors hover:bg-white/5 hover:text-accent-cyan ${
              userMenuOpen ? 'bg-white/5 text-accent-cyan' : 'text-text-secondary'
            }`}
            aria-label="User profile"
          >
            {userEmail ? <CheckCircle2 size={18} className="text-accent-green" /> : <UserCircle2 size={18} />}
          </motion.button>

          <AnimatePresence>
            {userMenuOpen && userEmail && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                className="glass-strong absolute right-0 top-11 z-50 w-56 rounded-lg p-2 shadow-glass"
              >
                <div className="border-b border-white/5 px-2 pb-2">
                  <div className="label-eyebrow">Signed in as</div>
                  <div className="truncate font-mono-tech text-[12px] text-text-primary">{userEmail}</div>
                </div>
                <button
                  onClick={() => {
                    setUserEmail(null);
                    setUserMenuOpen(false);
                  }}
                  className="mt-1 flex w-full items-center gap-2 rounded px-2 py-1.5 text-left font-mono-tech text-[12px] text-text-secondary transition-colors hover:bg-white/5 hover:text-accent-red"
                >
                  <LogOut size={13} />
                  Sign out
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <AnimatePresence>
        {loginOpen && (
          <LoginModal
            onClose={() => setLoginOpen(false)}
            onSignedIn={(email) => {
              setUserEmail(email);
              setLoginOpen(false);
            }}
          />
        )}
      </AnimatePresence>
    </header>
  );
}

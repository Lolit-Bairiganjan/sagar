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
  ArrowLeft,
  Sun,
  Moon,
} from 'lucide-react';
import { soundEngine } from '../utils/soundEngine';
import type { Investigation, SystemStatus } from '../types';

interface TopBarProps {
  investigation: Investigation | null;
  systemStatus: SystemStatus | null;
  onBackToLanding?: () => void;
  isLight?: boolean;
  onToggleTheme?: () => void;
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
      onClick={() => {
        soundEngine.playBubbleHover();
        onChange(!checked);
      }}
      className="flex w-full items-center justify-between gap-3 px-2 py-1.5 text-left transition-colors hover:bg-white/5 cursor-pointer"
    >
      <span className="flex items-center gap-2 font-mono text-[12px] text-inherit opacity-80">
        <Icon size={13} className="opacity-60" />
        {label}
      </span>
      <span
        className={`relative h-4 w-7 shrink-0 transition-colors ${
          checked ? 'bg-[#FF6600]' : 'bg-white/15'
        }`}
      >
        <span
          className={`absolute top-0.5 h-3 w-3 bg-white transition-transform ${
            checked ? 'translate-x-3.5' : 'translate-x-0.5'
          }`}
        />
      </span>
    </button>
  );
}

function SettingsPanel({ onClose, isLight = false }: { onClose: () => void; isLight?: boolean }) {
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
      className={`absolute right-0 top-11 z-50 w-64 border p-2 shadow-lg ${
        isLight ? 'bg-white border-black/15 text-[#14161B]' : 'bg-[#181B22] border-[#2D323E] text-white'
      }`}
    >
      <div className="mb-1 flex items-center justify-between px-2 py-1 border-b border-white/5">
        <span className="font-mono text-[10px] tracking-wider uppercase text-[#FF6600] font-semibold">Settings</span>
        <button
          onClick={onClose}
          onMouseEnter={() => soundEngine.playBubbleHover()}
          className="text-inherit opacity-60 transition-colors hover:opacity-100 hover:text-[#FF6600] cursor-pointer"
        >
          <X size={14} />
        </button>
      </div>
      <div className="space-y-0.5 pt-1">
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

export default function TopBar({
  investigation,
  systemStatus,
  onBackToLanding,
  isLight = false,
  onToggleTheme,
}: TopBarProps) {
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
    <header
      className={`relative z-30 flex h-14 shrink-0 items-center justify-between border-b px-4 transition-colors ${
        isLight
          ? 'bg-[#EDEFF4] border-[#CBD0DA] text-[#14161B]'
          : 'bg-[#14161B] border-[#252932] text-white'
      }`}
    >
      {/* Left: identity */}
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center bg-[#FF6600] text-white font-display font-black text-sm shadow-[0_0_10px_rgba(255,102,0,0.4)]">
          S
        </div>
        <div className="min-w-0 leading-tight">
          <div className="font-display text-xs font-bold tracking-[0.18em] flex items-center gap-1.5">
            SAGAR <span className="text-[10px] text-[#FF6600] font-normal">// DEFENSE</span>
          </div>
          <div className="font-mono text-[9px] tracking-widest text-[#6B7280]">
            MISSION CONTROL CONSOLE
          </div>
        </div>
        <div
          className={`ml-2 hidden items-center gap-1.5 border-l pl-3 sm:flex ${
            isLight ? 'border-black/15' : 'border-[#252932]'
          }`}
        >
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-green shadow-[0_0_6px_rgba(61,232,136,0.8)]" />
          <span className="font-mono text-[10px] uppercase tracking-widest text-accent-green">
            System Online
          </span>
        </div>
        {onBackToLanding && (
          <button
            onClick={onBackToLanding}
            onMouseEnter={() => soundEngine.playBubbleHover()}
            className={`ml-3 hidden sm:flex items-center gap-1.5 border px-2.5 py-1 font-mono text-[11px] font-semibold transition-all cursor-pointer select-none active:scale-95 ${
              isLight
                ? 'border-black/15 bg-white text-[#14161B] hover:border-[#FF6600] hover:text-[#FF6600]'
                : 'border-[#2D323E] bg-[#1B1E25] text-[#A2A8B5] hover:text-white hover:border-[#FF6600]'
            }`}
            title="Return to Mission Hub Landing Page"
          >
            <ArrowLeft size={12} className="text-[#FF6600]" />
            <span>RETURN TO HUB</span>
          </button>
        )}
      </div>

      {/* Center: operation */}
      <div className="hidden flex-col items-center leading-tight md:flex">
        <div className="font-mono text-xs font-semibold tracking-widest">
          {investigation?.operationName ?? 'OPERATION: BLUE HORIZON'}
        </div>
        <div className="font-mono text-[10px] tracking-wider text-[#FF6600]">
          {investigation?.sector ?? 'ARABIAN SEA / SECTOR 07'}
        </div>
      </div>

      {/* Right: status + controls */}
      <div className="flex items-center gap-3 sm:gap-4">
        <div
          className={`hidden items-center gap-3 sm:gap-4 border-r pr-3 sm:pr-4 xl:flex ${
            isLight ? 'border-black/15' : 'border-[#252932]'
          }`}
        >
          <StatusChip icon={Satellite} label="SAT" active={systemStatus?.satellite !== 'OFFLINE'} />
          <StatusChip icon={Radio} label="AIS" active={systemStatus?.ais !== 'OFFLINE'} />
          <StatusChip icon={CloudSun} label="WX" active={systemStatus?.weather !== 'OFFLINE'} />
        </div>
        <span className="font-mono text-xs tabular-nums text-[#6B7280]">{indianTime}</span>

        {/* Theme Toggle Button */}
        {onToggleTheme && (
          <button
            onClick={onToggleTheme}
            onMouseEnter={() => soundEngine.playBubbleHover()}
            className={`h-8 w-8 inline-flex items-center justify-center border transition-colors select-none cursor-pointer ${
              isLight
                ? 'border-black/15 bg-white text-[#14161B] hover:border-[#FF6600]'
                : 'border-[#2D323E] bg-[#1B1E25] text-[#A2A8B5] hover:text-white hover:border-[#FF6600]/40'
            }`}
            title={isLight ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
            aria-label="Toggle Theme"
          >
            {isLight ? <Moon size={14} /> : <Sun size={14} />}
          </button>
        )}

        {/* Settings */}
        <div className="relative">
          <button
            onClick={() => {
              soundEngine.playBubbleHover();
              setSettingsOpen((v) => !v);
            }}
            onMouseEnter={() => soundEngine.playBubbleHover()}
            className={`h-8 w-8 inline-flex items-center justify-center border transition-colors select-none cursor-pointer ${
              settingsOpen
                ? 'border-[#FF6600] text-[#FF6600]'
                : isLight
                ? 'border-black/15 bg-white text-[#4B5262] hover:border-[#FF6600]'
                : 'border-[#2D323E] bg-[#1B1E25] text-[#A2A8B5] hover:text-white hover:border-[#FF6600]/40'
            }`}
            aria-label="Settings"
          >
            <Settings size={14} />
          </button>
          <AnimatePresence>
            {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} isLight={isLight} />}
          </AnimatePresence>
        </div>

        {/* User */}
        <div className="relative" ref={userMenuRef}>
          <button
            onClick={() => {
              soundEngine.playBubbleHover();
              if (userEmail) {
                setUserMenuOpen((v) => !v);
              } else {
                setLoginOpen(true);
              }
            }}
            onMouseEnter={() => soundEngine.playBubbleHover()}
            className={`h-8 w-8 inline-flex items-center justify-center border transition-colors select-none cursor-pointer ${
              userMenuOpen
                ? 'border-[#FF6600] text-[#FF6600]'
                : isLight
                ? 'border-black/15 bg-white text-[#4B5262] hover:border-[#FF6600]'
                : 'border-[#2D323E] bg-[#1B1E25] text-[#A2A8B5] hover:text-white hover:border-[#FF6600]/40'
            }`}
            aria-label="User profile"
          >
            {userEmail ? <CheckCircle2 size={16} className="text-accent-green" /> : <UserCircle2 size={16} />}
          </button>

          <AnimatePresence>
            {userMenuOpen && userEmail && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                className={`absolute right-0 top-11 z-50 w-56 border p-2 shadow-lg ${
                  isLight ? 'bg-white border-black/15' : 'bg-[#181B22] border-[#2D323E]'
                }`}
              >
                <div className="border-b border-white/5 px-2 pb-2">
                  <div className="label-eyebrow">Signed in as</div>
                  <div className="truncate font-mono text-[12px] text-text-primary">{userEmail}</div>
                </div>
                <button
                  onClick={() => {
                    setUserEmail(null);
                    setUserMenuOpen(false);
                  }}
                  className="mt-1 flex w-full items-center gap-2 px-2 py-1.5 text-left font-mono text-[12px] text-[#A2A8B5] transition-colors hover:text-accent-red"
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

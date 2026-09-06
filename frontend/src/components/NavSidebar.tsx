import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  Radar,
  Droplets,
  ShipWheel,
  Satellite,
  ChevronsLeft,
  ChevronsRight,
  ExternalLink,
} from 'lucide-react';
import type { SystemStatus } from '../types';
import { soundEngine } from '../utils/soundEngine';

export interface NavItem {
  label: string;
  icon: React.ElementType;
  referenceUrl: string;
}

export const NAV_ITEMS: NavItem[] = [
  {
    label: 'Overview',
    icon: LayoutDashboard,
    referenceUrl: 'https://en.wikipedia.org/wiki/Maritime_domain_awareness',
  },
  {
    label: 'Live Surveillance',
    icon: Radar,
    referenceUrl: 'https://www.marinetraffic.com/',
  },
  {
    label: 'Spill Analysis',
    icon: Droplets,
    referenceUrl: 'https://www.itopf.org/knowledge-resources/documents-guides/',
  },
  {
    label: 'Vessel Attribution',
    icon: ShipWheel,
    referenceUrl: 'https://www.equasis.org/',
  },
  {
    label: 'AIS Traffic',
    icon: Radar,
    referenceUrl: 'https://www.marinetraffic.com/en/ais/home',
  },
  {
    label: 'Satellite Imagery',
    icon: Satellite,
    referenceUrl: 'https://apps.sentinel-hub.com/eo-browser/',
  },
];

function StatusRow({ label, value }: { label: string; value: string }) {
  const isPositive = ['ONLINE', 'CONNECTED', 'AVAILABLE'].includes(value);
  return (
    <div className="flex items-center justify-between font-mono text-[11px]">
      <span className="text-[#8E95A5]">{label}:</span>
      <span className={isPositive ? 'text-accent-green font-semibold' : 'text-accent-amber font-semibold'}>
        {value}
      </span>
    </div>
  );
}

interface NavSidebarProps {
  systemStatus: SystemStatus | null;
  active: string;
  onSelect: (label: string) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  isLight?: boolean;
}

export default function NavSidebar({
  systemStatus,
  active,
  onSelect,
  collapsed,
  onToggleCollapsed,
  isLight = false,
}: NavSidebarProps) {
  return (
    <aside
      className={`relative z-20 flex shrink-0 flex-col border-r transition-[width] duration-300 ${
        collapsed ? 'w-14' : 'w-56'
      } ${
        isLight
          ? 'bg-white border-[#CBD0DA] text-[#14161B]'
          : 'bg-[#181B22] border-[#252932] text-white'
      }`}
    >
      <nav className="flex-1 overflow-y-auto py-3">
        {NAV_ITEMS.map((item) => {
          const isActive = item.label === active;
          return (
            <motion.button
              key={item.label}
              onClick={() => {
                onSelect(item.label);
                window.open(item.referenceUrl, '_blank', 'noopener,noreferrer');
              }}
              onMouseEnter={() => soundEngine.playBubbleHover()}
              whileHover={{ x: collapsed ? 0 : 3 }}
              whileTap={{ scale: 0.96 }}
              className={`group relative flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors cursor-pointer ${
                isActive
                  ? 'text-[#FF6600] font-bold'
                  : isLight
                  ? 'text-[#4B5262] hover:text-[#14161B]'
                  : 'text-[#A2A8B5] hover:text-white'
              }`}
              title={collapsed ? item.label : undefined}
            >
              {isActive && (
                <motion.span
                  layoutId="nav-active-bg"
                  className="absolute inset-y-0.5 left-1 right-1 border border-[#FF6600]/30 bg-[#FF6600]/10"
                  transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                />
              )}
              {isActive && (
                <motion.span
                  layoutId="nav-active-bar"
                  className="absolute left-0 top-0 h-full w-1 bg-[#FF6600]"
                  transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                />
              )}
              <item.icon size={16} className="relative z-10 shrink-0" />
              {!collapsed && (
                <span className="relative z-10 flex min-w-0 flex-1 items-center justify-between gap-1.5">
                  <span className="truncate font-mono text-xs tracking-wide">{item.label}</span>
                  <ExternalLink size={11} className="shrink-0 opacity-40 group-hover:opacity-80" />
                </span>
              )}
            </motion.button>
          );
        })}
      </nav>

      <div className={`border-t p-3 ${isLight ? 'border-black/10' : 'border-[#252932]'}`}>
        {!collapsed && (
          <>
            <div className="font-mono text-[10px] tracking-wider uppercase text-[#6B7280] mb-2 font-semibold">
              System Telemetry
            </div>
            <div className="space-y-1.5">
              <StatusRow label="Satellite" value={systemStatus?.satellite ?? 'ONLINE'} />
              <StatusRow label="AIS" value={systemStatus?.ais ?? 'CONNECTED'} />
              <StatusRow label="Weather" value={systemStatus?.weather ?? 'AVAILABLE'} />
              <StatusRow label="Backend" value={systemStatus?.backend ?? 'MOCK MODE'} />
            </div>
          </>
        )}
        <button
          onClick={onToggleCollapsed}
          onMouseEnter={() => soundEngine.playBubbleHover()}
          className={`mt-3 flex w-full items-center justify-center gap-1.5 border py-1.5 text-xs transition-colors cursor-pointer select-none ${
            isLight
              ? 'border-black/15 text-[#4B5262] hover:border-[#FF6600] hover:text-[#FF6600]'
              : 'border-white/10 text-[#A2A8B5] hover:border-[#FF6600] hover:text-white'
          }`}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronsRight size={14} /> : <ChevronsLeft size={14} />}
        </button>
      </div>
    </aside>
  );
}

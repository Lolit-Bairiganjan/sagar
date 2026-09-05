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

export interface NavItem {
  label: string;
  icon: React.ElementType;
  /** Reference link opened (in a new tab) when this section is selected.
   *  Each section currently renders the same map view, so — as a frontend
   *  placeholder/demo — clicking a section also points to a real-world
   *  reference page for that capability. Swap these for real in-app routes
   *  once each section has its own dedicated view. */
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
    <div className="flex items-center justify-between font-mono-tech text-[12px]">
      <span className="text-text-muted">{label}:</span>
      <span className={isPositive ? 'text-accent-green' : 'text-accent-amber'}>{value}</span>
    </div>
  );
}

interface NavSidebarProps {
  systemStatus: SystemStatus | null;
  active: string;
  onSelect: (label: string) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

export default function NavSidebar({
  systemStatus,
  active,
  onSelect,
  collapsed,
  onToggleCollapsed,
}: NavSidebarProps) {
  return (
    <aside
      className={`glass-strong relative z-20 flex shrink-0 flex-col border-r-0 transition-[width] duration-300 ${
        collapsed ? 'w-14' : 'w-56'
      }`}
    >
      <nav className="perspective flex-1 overflow-y-auto py-3">
        {NAV_ITEMS.map((item) => {
          const isActive = item.label === active;
          return (
            <motion.button
              key={item.label}
              onClick={() => {
                onSelect(item.label);
                // Placeholder frontend behavior: each section opens a
                // relevant reference webpage in a new tab.
                window.open(item.referenceUrl, '_blank', 'noopener,noreferrer');
              }}
              whileHover={{ x: collapsed ? 0 : 3, rotateY: collapsed ? 0 : -4 }}
              whileTap={{ scale: 0.96, rotateX: 6 }}
              transition={{ type: 'spring', stiffness: 340, damping: 22 }}
              style={{ transformPerspective: 600, transformOrigin: 'left center' }}
              className={`group relative flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                isActive ? 'text-accent-cyan' : 'text-text-secondary hover:text-text-primary'
              }`}
              title={collapsed ? item.label : undefined}
            >
              {isActive && (
                <motion.span
                  layoutId="nav-active-bg"
                  className="absolute inset-y-0.5 left-1 right-1 rounded-md border border-accent-cyan/30 bg-accent-cyan/10 shadow-glowCyan"
                  transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                />
              )}
              {isActive && (
                <motion.span
                  layoutId="nav-active-bar"
                  className="absolute left-0 top-0 h-full w-0.5 bg-accent-cyan shadow-glowCyan"
                  transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                />
              )}
              <item.icon size={16} className="relative z-10 shrink-0" />
              {!collapsed && (
                <span className="relative z-10 flex min-w-0 flex-1 items-center justify-between gap-1.5">
                  <span className="truncate font-mono-tech text-[13px] tracking-wide">{item.label}</span>
                  <ExternalLink size={11} className="shrink-0 opacity-40 group-hover:opacity-80" />
                </span>
              )}
            </motion.button>
          );
        })}
      </nav>

      <div className="border-t border-white/5 p-3">
        {!collapsed && (
          <>
            <div className="label-eyebrow mb-2">System Status</div>
            <div className="space-y-1.5">
              <StatusRow label="Satellite" value={systemStatus?.satellite ?? 'ONLINE'} />
              <StatusRow label="AIS" value={systemStatus?.ais ?? 'CONNECTED'} />
              <StatusRow label="Weather" value={systemStatus?.weather ?? 'AVAILABLE'} />
              <StatusRow label="Backend" value={systemStatus?.backend ?? 'MOCK MODE'} />
            </div>
          </>
        )}
        <motion.button
          onClick={onToggleCollapsed}
          whileHover={{ rotateX: 10 }}
          whileTap={{ scale: 0.94 }}
          style={{ transformPerspective: 400 }}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded border border-white/10 py-1.5 text-text-muted transition-colors hover:border-accent-cyan/40 hover:text-accent-cyan"
        >
          {collapsed ? <ChevronsRight size={14} /> : <ChevronsLeft size={14} />}
        </motion.button>
      </div>
    </aside>
  );
}

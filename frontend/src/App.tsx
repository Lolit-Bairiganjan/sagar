import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Loader2 } from 'lucide-react';
import TopBar from './components/TopBar';
import NavSidebar from './components/NavSidebar';
import MapView from './components/MapView';
import Sidebar from './components/Sidebar';
import IntelligencePanel from './components/IntelligencePanel';
import BottomTimeline from './components/BottomTimeline';
import StartupScreen from './components/StartupScreen';
import LandingPage from './components/LandingPage';
import AmbientBackground from './components/AmbientBackground';
import SectionTransition from './components/SectionTransition';
import {
  getSpillData,
  getVessels,
  getVesselTrack,
  getSatelliteData,
  getOceanographicData,
  getInvestigation,
  getSystemStatus,
} from './api/client';
import type {
  Spill,
  Vessel,
  VesselTrack,
  SatelliteObservation,
  OceanographicData,
  Investigation,
  SystemStatus,
} from './types';

const LOADING_MESSAGES = [
  'ANALYZING SATELLITE DATA...',
  'ESTABLISHING AIS CORRELATION...',
  'RECONSTRUCTING VESSEL TRAJECTORIES...',
  'CALCULATING DRIFT MODEL...',
];

function LoadingScreen() {
  const [msgIndex, setMsgIndex] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setMsgIndex((i) => (i + 1) % LOADING_MESSAGES.length), 900);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4">
      <div className="glass flex flex-col items-center gap-4 rounded-lg px-10 py-8">
        <Loader2 size={22} className="animate-spin text-accent-cyan" />
        <span className="font-mono-tech text-xs tracking-widest text-text-secondary">
          {LOADING_MESSAGES[msgIndex]}
        </span>
        <div className="h-1 w-56 overflow-hidden rounded-full bg-bg-raised">
          <div className="h-full w-1/3 animate-[scan_1.4s_ease-in-out_infinite] bg-accent-cyan" />
        </div>
      </div>
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="relative z-20 flex items-center gap-2 border-b border-accent-amber/30 bg-accent-amber/10 px-4 py-2 font-mono-tech text-[13px] text-accent-amber backdrop-blur-md">
      <AlertTriangle size={13} />
      <span>{message}</span>
      <span className="text-text-muted"> — displaying simulation data</span>
    </div>
  );
}

export default function App() {
  const [booted, setBooted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [spill, setSpill] = useState<Spill | null>(null);
  const [vessels, setVessels] = useState<Vessel[]>([]);
  const [tracks, setTracks] = useState<Record<string, VesselTrack>>({});
  const [satellite, setSatellite] = useState<SatelliteObservation | null>(null);
  const [ocean, setOcean] = useState<OceanographicData | null>(null);
  const [investigation, setInvestigation] = useState<Investigation | null>(null);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);

  const [selectedVesselId, setSelectedVesselId] = useState<string | null>(null);
  const [centerTargetVessel, setCenterTargetVessel] = useState<Vessel | null>(null);

  const [activeSection, setActiveSection] = useState('Live Surveillance');
  const [navCollapsed, setNavCollapsed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [spillData, vesselData, satelliteData, oceanData, investigationData, statusData] =
          await Promise.all([
            getSpillData(),
            getVessels(),
            getSatelliteData(),
            getOceanographicData(),
            getInvestigation(),
            getSystemStatus(),
          ]);

        if (cancelled) return;

        setSpill(spillData);
        setVessels(vesselData);
        setSatellite(satelliteData);
        setOcean(oceanData);
        setInvestigation(investigationData);
        setSystemStatus(statusData);

        const trackEntries = await Promise.all(
          vesselData.map(async (v) => [v.id, await getVesselTrack(v.id)] as const),
        );
        if (cancelled) return;
        setTracks(Object.fromEntries(trackEntries));
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'BACKEND CONNECTION UNAVAILABLE');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedVessel = useMemo(
    () => vessels.find((v) => v.id === selectedVesselId) ?? null,
    [vessels, selectedVesselId],
  );

  const handleSelectVessel = useCallback(
    (id: string) => {
      setSelectedVesselId((current) => (current === id ? current : id));
      const vessel = vessels.find((v) => v.id === id) ?? null;
      setCenterTargetVessel(vessel);
    },
    [vessels],
  );

  const handleDeselect = useCallback(() => {
    setSelectedVesselId(null);
    setCenterTargetVessel(null);
  }, []);

  const [viewMode, setViewMode] = useState<'landing' | 'console'>('landing');

  if (viewMode === 'landing') {
    return <LandingPage onEnter={() => setViewMode('console')} />;
  }

  return (
    <div className="relative flex h-screen w-screen flex-col overflow-hidden bg-bg-primary">
      <AmbientBackground />

      <div className="relative z-10 flex h-full min-h-0 flex-1 flex-col">
        <TopBar
          investigation={investigation}
          systemStatus={systemStatus}
          onBackToLanding={() => setViewMode('landing')}
        />
        {error && <ErrorBanner message={error} />}

        <div className="flex min-h-0 flex-1">
          <NavSidebar
            systemStatus={systemStatus}
            active={activeSection}
            onSelect={setActiveSection}
            collapsed={navCollapsed}
            onToggleCollapsed={() => setNavCollapsed((c) => !c)}
          />

          <main className="min-w-0 flex-1">
            {loading ? (
              <LoadingScreen />
            ) : (
              <SectionTransition sectionKey={activeSection}>
                <MapView
                  spill={spill}
                  vessels={vessels}
                  tracks={tracks}
                  satellite={satellite}
                  selectedVesselId={selectedVesselId}
                  onSelectVessel={handleSelectVessel}
                  centerTargetVessel={centerTargetVessel}
                  activeSection={activeSection}
                  onEmptyMapClick={handleDeselect}
                />
              </SectionTransition>
            )}
          </main>

          <motion.div
            key={`sidebar-${activeSection}`}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="hidden w-72 shrink-0 lg:block"
          >
            <Sidebar vessels={vessels} selectedVesselId={selectedVesselId} onSelectVessel={handleSelectVessel} />
          </motion.div>

          <AnimatePresence mode="wait" initial={false}>
            {selectedVessel && (
              <motion.div
                key={`intel-${selectedVessel.id}`}
                initial={{ opacity: 0, x: 32, scale: 0.985 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 40, scale: 0.985 }}
                transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                className="hidden w-80 shrink-0 xl:block"
              >
                <IntelligencePanel
                  spill={spill}
                  satellite={satellite}
                  ocean={ocean}
                  selectedVessel={selectedVessel}
                  onDeselect={handleDeselect}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <BottomTimeline />
      </div>
    </div>
  );
}

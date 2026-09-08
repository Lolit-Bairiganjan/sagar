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
import ConsoleLoadingScreen from './components/ConsoleLoadingScreen';
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
  HistoricalSpillDetail,
} from './types';

const LOADING_MESSAGES = [
  'ANALYZING SATELLITE DATA...',
  'ESTABLISHING AIS CORRELATION...',
  'RECONSTRUCTING VESSEL TRAJECTORIES...',
  'CALCULATING DRIFT MODEL...',
];

function LoadingScreen({ isLight = false }: { isLight?: boolean }) {
  const [msgIndex, setMsgIndex] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setMsgIndex((i) => (i + 1) % LOADING_MESSAGES.length), 900);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4">
      <div
        className={`flex flex-col items-center gap-4 border px-10 py-8 shadow-lg ${
          isLight ? 'bg-white border-black/15 text-[#14161B]' : 'bg-[#181B22] border-[#2D323E] text-white'
        }`}
      >
        <Loader2 size={24} className="animate-spin text-[#FF6600]" />
        <span className="font-mono text-xs tracking-widest text-[#6B7280]">
          {LOADING_MESSAGES[msgIndex]}
        </span>
        <div className="h-1 w-56 overflow-hidden bg-black/20">
          <div className="h-full w-1/3 animate-[scan_1.4s_ease-in-out_infinite] bg-[#FF6600]" />
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

  const handleSelectHistoricalSpill = useCallback((detail: HistoricalSpillDetail) => {
    setSpill(detail.spill);
    setOcean(detail.ocean);
    setInvestigation({
      id: `SPILL-${detail.spill_id}`,
      operationName: `INCIDENT #${detail.spill_id} ARCHIVE`,
      sector: `${detail.spill.centroid.lat.toFixed(2)}°N, ${detail.spill.centroid.lng.toFixed(2)}°E`,
      status: detail.spill.status,
      openedAtUtc: detail.spill.observedAtUtc,
    });

    if (detail.suspects && detail.suspects.length > 0) {
      const mappedVessels: Vessel[] = detail.suspects.map((cand, idx) => ({
        id: `v-${cand.mmsi}`,
        name: cand.name || `VESSEL ${cand.mmsi}`,
        imo: String(cand.mmsi),
        type: cand.flags?.[0] || 'Commercial Vessel',
        flag: 'TRACKED',
        speedKn: 12.0,
        headingDeg: 270,
        draftM: 8.0,
        currentLocation: detail.spill.origin?.location ?? detail.spill.centroid,
        isSuspect: true,
        rank: idx + 1,
        attribution: {
          attributionScorePct: cand.final_score,
          distanceNm: Number((cand.distance_km * 0.539957).toFixed(1)),
          timeDifferenceMinutes: Math.round(cand.hours_before_detection * 60),
          trajectoryMatchPct: Math.round(cand.proximity_score),
          behaviorAnomaly: cand.has_suspicious_gap ? 'HIGH' : 'LOW',
          risk: cand.final_score >= 80 ? 'CRITICAL' : cand.final_score >= 50 ? 'HIGH' : 'MEDIUM',
          breakdown: {
            spatialProximity: { score: Math.round(cand.proximity_score), max: 100 },
            temporalCorrelation: { score: Math.round(cand.time_score), max: 100 },
            trajectoryMatch: { score: Math.round(cand.proximity_score), max: 100 },
            behaviorAnomaly: { score: cand.has_suspicious_gap ? 90 : 20, max: 100 },
          },
          correlation: {
            spatialPct: Math.round(cand.proximity_score),
            temporalPct: Math.round(cand.time_score),
            trajectoryPct: Math.round(cand.proximity_score),
            behaviorPct: cand.has_suspicious_gap ? 90 : 20,
            overallPct: Math.round(cand.final_score),
          },
        },
        anomalyEvents: (cand.flags || []).map((flag) => ({
          timestampUtc: detail.spill.observedAtUtc,
          label: 'FORENSIC FLAG',
          description: flag,
          severity: 'WARNING',
        })),
      }));
      setVessels(mappedVessels);
      if (mappedVessels.length > 0) {
        setSelectedVesselId(mappedVessels[0].id);
      }
    }
  }, []);

  const [themeMode, setThemeMode] = useState<'dark' | 'light'>('dark');
  const isLight = themeMode === 'light';
  const [viewMode, setViewMode] = useState<'landing' | 'loading' | 'console'>('landing');

  const handleLaunchConsole = useCallback(() => {
    // Clear URL hash (e.g. #neural-model) so address bar displays clean URL
    if (window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname);
    }
    setViewMode('loading');
  }, []);

  const handleBackToLanding = useCallback(() => {
    setViewMode('landing');
  }, []);

  if (viewMode === 'landing') {
    return (
      <LandingPage
        onEnter={handleLaunchConsole}
        themeMode={themeMode}
        onToggleTheme={() => setThemeMode((m) => (m === 'dark' ? 'light' : 'dark'))}
      />
    );
  }

  if (viewMode === 'loading') {
    return (
      <ConsoleLoadingScreen
        isLight={isLight}
        onComplete={() => setViewMode('console')}
      />
    );
  }

  return (
    <div
      style={{ backgroundColor: isLight ? '#EDEFF4' : '#14161B' }}
      className={`relative flex h-screen w-screen flex-col overflow-hidden font-sans select-none transition-colors ${
        isLight ? 'theme-light text-[#14161B]' : 'text-white'
      }`}
    >
      {/* Background CAD Grid */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 chaingpt-grid opacity-30" />
        <div className="absolute inset-0 chaingpt-dots opacity-20" />
      </div>

      <div className="relative z-10 flex h-full min-h-0 flex-1 flex-col">
        <TopBar
          investigation={investigation}
          systemStatus={systemStatus}
          onBackToLanding={handleBackToLanding}
          isLight={isLight}
          onToggleTheme={() => setThemeMode((m) => (m === 'dark' ? 'light' : 'dark'))}
        />
        {error && <ErrorBanner message={error} />}

        <div className="flex min-h-0 flex-1">
          <NavSidebar
            systemStatus={systemStatus}
            active={activeSection}
            onSelect={setActiveSection}
            collapsed={navCollapsed}
            onToggleCollapsed={() => setNavCollapsed((c) => !c)}
            isLight={isLight}
          />

          <main className="min-w-0 flex-1">
            {loading ? (
              <LoadingScreen isLight={isLight} />
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
                  isLight={isLight}
                  onSelectHistoricalSpill={handleSelectHistoricalSpill}
                  onNavigateSection={setActiveSection}
                />
              </SectionTransition>
            )}
          </main>

          {/* Single Consolidated Right Dock: flips between Suspects List and Selected Vessel Dossier */}
          {activeSection !== 'Live Surveillance' && (
            <div
              className={`hidden w-80 shrink-0 border-l transition-colors lg:block relative z-20 overflow-hidden ${
                isLight ? 'border-[#CBD0DA] bg-[#EDEFF4]' : 'border-[#252932] bg-[#181B22]'
              }`}
            >
              <AnimatePresence mode="wait" initial={false}>
                {selectedVessel ? (
                  <motion.div
                    key={`intel-${selectedVessel.id}`}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.22 }}
                    className="h-full w-full"
                  >
                    <IntelligencePanel
                      spill={spill}
                      satellite={satellite}
                      ocean={ocean}
                      selectedVessel={selectedVessel}
                      onDeselect={handleDeselect}
                      isLight={isLight}
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="sidebar-suspects-list"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.22 }}
                    className="h-full w-full"
                  >
                    <Sidebar
                      vessels={vessels}
                      selectedVesselId={selectedVesselId}
                      onSelectVessel={handleSelectVessel}
                      isLight={isLight}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        <BottomTimeline isLight={isLight} />
      </div>
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Loader2 } from 'lucide-react';
import TopBar from './components/TopBar';
import NavSidebar from './components/NavSidebar';
import MapView from './components/MapView';
import Sidebar from './components/Sidebar';
import IntelligencePanel from './components/IntelligencePanel';
import StartupScreen from './components/StartupScreen';
import LandingPage from './components/LandingPage';
import AmbientBackground from './components/AmbientBackground';
import SectionTransition from './components/SectionTransition';
import ConsoleLoadingScreen from './components/ConsoleLoadingScreen';
import BottomTimeline from './components/BottomTimeline';
import {
  getSpillData,
  getVessels,
  getVesselTrack,
  getSatelliteData,
  getOceanographicData,
  getInvestigation,
  getSystemStatus,
  getSpillReconstruction,
  getHistoricalSpillDetail,
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
  SurveillanceScanResult,
  DriftReconstruction,
  SuspectCandidate,
} from './types';

function toScanMaxSuspect(candidate?: SuspectCandidate): SurveillanceScanResult['max_suspect'] {
  if (!candidate) return undefined;
  return {
    mmsi: candidate.mmsi,
    name: candidate.name,
    final_score: candidate.final_score,
    ranking_score_pct: candidate.final_score,
    distance_km: candidate.distance_km,
    hours_before: candidate.hours_before_detection,
    ais_search_start: candidate.ais_search_start,
    ais_search_end: candidate.ais_search_end,
    origin_corridor_radius_km: candidate.origin_corridor_radius_km,
    vessel_type: candidate.flags?.[0],
    flags: candidate.flags,
    factors: {
      proximity_score: candidate.proximity_score,
      time_score: candidate.time_score,
      type_score: candidate.type_score,
      gap_score: candidate.gap_score,
      speed_anomaly_score: candidate.speed_anomaly_score,
      heading_alignment_score: candidate.heading_alignment_score ?? null,
      heading_evidence_available: candidate.heading_evidence_available ?? false,
    },
  };
}

function persistedSpillForDetection(
  result: SurveillanceScanResult | null,
  index: number,
): number | null {
  if (!result) return null;
  if (result.persisted_spill_ids_by_detection) {
    return result.persisted_spill_ids_by_detection[index] ?? null;
  }
  return result.persisted_spill_ids[index] ?? null;
}

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
  const [surveillanceResult, setSurveillanceResult] = useState<SurveillanceScanResult | null>(null);
  const [selectedScanSpillIndex, setSelectedScanSpillIndex] = useState(0);
  const [selectedSpillId, setSelectedSpillId] = useState<number | null>(null);
  const [reconstruction, setReconstruction] = useState<DriftReconstruction | null>(null);
  const [reconstructionLoading, setReconstructionLoading] = useState(false);
  const [reconstructionError, setReconstructionError] = useState<string | null>(null);
  const [selectedFrameIndex, setSelectedFrameIndex] = useState(0);

  const [selectedVesselId, setSelectedVesselId] = useState<string | null>(null);
  const [centerTargetVessel, setCenterTargetVessel] = useState<Vessel | null>(null);

  const [activeSection, setActiveSection] = useState('AIS Traffic');
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
        const spillIdMatch = /^SPILL-(\d+)$/.exec(spillData.id);
        setSelectedSpillId(spillIdMatch ? Number(spillIdMatch[1]) : null);
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

  useEffect(() => {
    let cancelled = false;
    setReconstruction(null);
    setSelectedFrameIndex(0);
    setReconstructionError(null);

    if (selectedSpillId === null) {
      setReconstructionLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setReconstructionLoading(true);
    getSpillReconstruction(selectedSpillId)
      .then((result) => {
        if (cancelled) return;
        setReconstruction(result);
        setSelectedFrameIndex(Math.max(0, (result?.frames.length ?? 1) - 1));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : 'Failed to load reconstruction';
        setReconstructionError(message);
        console.error(`Unable to load reconstruction for spill ${selectedSpillId}:`, err);
      })
      .finally(() => {
        if (!cancelled) setReconstructionLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedSpillId]);

  useEffect(() => {
    if (selectedSpillId === null) return;
    let cancelled = false;
    getHistoricalSpillDetail(selectedSpillId)
      .then((detail) => {
        if (cancelled) return;
        setSpill(detail.spill);
        setOcean(detail.ocean);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Unable to load spill details';
          setReconstructionError(`Unable to load spill ${selectedSpillId}: ${message}`);
          console.error(`Unable to load spill details for spill ${selectedSpillId}:`, err);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedSpillId]);

  const handleFrameIndexChange = useCallback((index: number) => {
    setSelectedFrameIndex(index);
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
    const aisStatus =
      detail.coverage_status === 'unavailable' ||
      detail.coverage_status === 'insufficient_ais_coverage'
        ? 'unavailable'
        : detail.suspects.length > 0
        ? 'available'
        : 'no_candidates';
    setSurveillanceResult({
      status: 'ANOMALY_DETECTED',
      zone: `Archived spill #${detail.spill_id}`,
      zone_key: 'historical',
      aoi_bbox: [],
      total_slicks_detected: 1,
      total_area_km2: detail.spill.estimatedAreaKm2,
      pipeline_latency_seconds: 0,
      timestamp: detail.spill.observedAtUtc,
      spills: [],
      persisted_spill_ids: [detail.spill_id],
      suspects: detail.suspects,
      max_suspect: toScanMaxSuspect(detail.suspects[0]),
      ais_status: aisStatus,
      ais_error: detail.coverage_error ?? undefined,
    });
    setVessels([]);
    setSelectedVesselId(null);
    setSelectedSpillId(detail.spill_id);
    setSelectedFrameIndex(0);
    setOcean(detail.ocean);
    setInvestigation({
      id: `SPILL-${detail.spill_id}`,
      operationName: `INCIDENT #${detail.spill_id} ARCHIVE`,
      sector: `${detail.spill.centroid.lat.toFixed(2)}°N, ${detail.spill.centroid.lng.toFixed(2)}°E`,
      status: detail.spill.status,
      openedAtUtc: detail.spill.observedAtUtc,
    });

  }, []);

  const handleSurveillanceResult = useCallback((result: SurveillanceScanResult | null) => {
    setSelectedScanSpillIndex(0);
    setSelectedFrameIndex(0);
    setReconstruction(null);
    setVessels([]);
    setSelectedVesselId(null);
    if (!result) {
      setSurveillanceResult(null);
      setSpill(null);
      setSelectedSpillId(null);
      return;
    }
    const firstInvestigation = result.spill_investigations?.[0];
    setSurveillanceResult({
      ...result,
      suspects: firstInvestigation?.suspects ?? result.suspects ?? [],
      max_suspect: toScanMaxSuspect(firstInvestigation?.suspects?.[0]) ?? result.max_suspect,
      ais_status: firstInvestigation?.ais_status,
      ais_error: firstInvestigation?.ais_error,
    });
    setSpill(null);
    setSelectedSpillId(persistedSpillForDetection(result, 0));
  }, []);

  const handleSelectScanSpill = useCallback((index: number) => {
    setSelectedScanSpillIndex(index);
    const investigation = surveillanceResult?.spill_investigations?.find(
      (item) => item.detection_index === index,
    );
    setSelectedSpillId(persistedSpillForDetection(surveillanceResult, index));
    setSelectedFrameIndex(0);
    setReconstruction(null);
    setSpill(null);
    setVessels([]);
    setSelectedVesselId(null);
    if (surveillanceResult) {
      setSurveillanceResult({
        ...surveillanceResult,
        suspects: investigation?.suspects ?? [],
        max_suspect: toScanMaxSuspect(investigation?.suspects?.[0]),
        ais_status: investigation?.ais_status,
        ais_error: investigation?.ais_error,
      });
    }
  }, [surveillanceResult]);

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

          <main className="flex min-h-0 min-w-0 flex-1 flex-col">
            {loading ? (
              <LoadingScreen isLight={isLight} />
            ) : (
              <SectionTransition sectionKey={activeSection} className="min-h-0 flex-1">
                <div className="flex h-full min-h-0 flex-col">
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
                    onSurveillanceResult={handleSurveillanceResult}
                    onSelectScanSpill={handleSelectScanSpill}
                    reconstructionFrames={reconstruction?.frames ?? []}
                    selectedFrameIndex={selectedFrameIndex}
                    hasDatabaseSpillId={selectedSpillId !== null}
                  />
                  <BottomTimeline
                    frames={reconstruction?.frames ?? []}
                    selectedIndex={selectedFrameIndex}
                    onIndexChange={handleFrameIndexChange}
                    loading={reconstructionLoading}
                    error={reconstructionError}
                    isLight={isLight}
                  />
                </div>
              </SectionTransition>
            )}
          </main>

          {/* Single Consolidated Right Dock: flips between Suspects List and Selected Vessel Dossier */}
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
                    surveillanceResult={surveillanceResult}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

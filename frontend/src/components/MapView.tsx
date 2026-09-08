import { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, useMap, useMapEvents, Polygon as RLPolygon, Tooltip as RLTooltip } from 'react-leaflet';
import { motion, AnimatePresence } from 'framer-motion';
import { Layers, Droplets, Route, TrendingUp, Radio, Satellite as SatelliteIcon } from 'lucide-react';
import SpillLayer from './SpillLayer';
import ShipTrackLayer from './ShipTrackLayer';
import SurveillancePanel from './SurveillancePanel';
import HistoricalSpillsPanel from './HistoricalSpillsPanel';
import type { Spill, Vessel, VesselTrack, SatelliteObservation, SurveillanceScanResult, HistoricalSpillDetail } from '../types';
import { soundEngine } from '../utils/soundEngine';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;
const CARTO_BASEMAP_KEY = import.meta.env.VITE_CARTO_BASEMAP_KEY as string | undefined;

const CARTO_DARK_URL = CARTO_BASEMAP_KEY
  ? `https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png?key=${CARTO_BASEMAP_KEY}`
  : undefined;
const CARTO_ATTRIBUTION =
  '&copy; <a href="https://carto.com/attributions">CARTO</a> &copy; OpenStreetMap contributors';

// Token-free fallback. The visual darkening is applied only to the raster tiles
// via the Leaflet TileLayer className, so overlays/markers keep their own colors.
const OSM_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const MAPBOX_URL = MAPBOX_TOKEN
  ? `https://api.mapbox.com/styles/v1/mapbox/dark-v11/tiles/{z}/{x}/{y}?access_token=${MAPBOX_TOKEN}`
  : undefined;
const MAPBOX_ATTRIBUTION = '&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> &copy; OpenStreetMap';

interface LayerToggles {
  spill: boolean;
  drift: boolean;
  forecast: boolean;
  ais: boolean;
  satellite: boolean;
}

function ToggleButton({
  active,
  onClick,
  icon: Icon,
  label,
  isLight = false,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  label: string;
  isLight?: boolean;
}) {
  return (
    <button
      onClick={() => {
        soundEngine.playBubbleHover();
        onClick();
      }}
      onMouseEnter={() => soundEngine.playBubbleHover()}
      className={`flex items-center gap-1.5 border px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
        active
          ? 'border-[#FF6600] bg-[#FF6600]/15 text-[#FF6600] shadow-[0_0_10px_rgba(255,102,0,0.25)]'
          : isLight
          ? 'border-black/10 bg-white text-[#4B5262] hover:border-[#FF6600]/60 hover:text-[#14161B]'
          : 'border-[#2D323E] bg-[#14161B] text-[#8E95A5] hover:border-[#FF6600]/40 hover:text-white'
      }`}
    >
      <Icon size={12} className={active ? 'text-[#FF6600]' : 'opacity-60'} />
      {label}
    </button>
  );
}

function FitToSpill({ spill }: { spill: Spill | null }) {
  const map = useMap();
  useEffect(() => {
    if (spill) {
      map.setView([spill.centroid.lat, spill.centroid.lng], 11, { animate: true });
    }
  }, [spill, map]);
  return null;
}

function FitToScan({ scan }: { scan: SurveillanceScanResult | null }) {
  const map = useMap();
  useEffect(() => {
    if (scan && scan.aoi_bbox && scan.aoi_bbox.length === 4) {
      const [minLon, minLat, maxLon, maxLat] = scan.aoi_bbox;
      map.fitBounds(
        [
          [minLat, minLon],
          [maxLat, maxLon],
        ],
        { padding: [60, 60], animate: true, maxZoom: 12 }
      );
    }
  }, [scan, map]);
  return null;
}

function FitToAoi({ bbox }: { bbox: [number, number, number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (bbox && bbox.length === 4) {
      const [minLon, minLat, maxLon, maxLat] = bbox;
      map.fitBounds(
        [
          [minLat, minLon],
          [maxLat, maxLon],
        ],
        { padding: [80, 80], animate: true, maxZoom: 11 }
      );
    }
  }, [bbox, map]);
  return null;
}

function DeselectOnEmptyMap({ onEmptyClick }: { onEmptyClick: () => void }) {
  useMapEvents({ click: () => onEmptyClick() });
  return null;
}

function CenterOnVessel({ vessel }: { vessel: Vessel | null }) {
  const map = useMap();
  useEffect(() => {
    if (vessel) {
      map.flyTo([vessel.currentLocation.lat, vessel.currentLocation.lng], 12, { duration: 0.8 });
    }
  }, [vessel, map]);
  return null;
}

/**
 * Interactive Map Drawing Handler:
 * Allows users to drag and draw a rectangular bounding box directly on Leaflet.
 * Bi-directionally syncs coordinates back to the SurveillancePanel inputs.
 */
function BoxDrawHandler({
  isDrawing,
  onBoxDrawn,
}: {
  isDrawing: boolean;
  onBoxDrawn: (bbox: [number, number, number, number]) => void;
}) {
  const map = useMap();
  const [startPoint, setStartPoint] = useState<[number, number] | null>(null);
  const [currentPoint, setCurrentPoint] = useState<[number, number] | null>(null);

  useEffect(() => {
    if (isDrawing) {
      map.dragging.disable();
      map.getContainer().style.cursor = 'crosshair';
    } else {
      map.dragging.enable();
      map.getContainer().style.cursor = '';
      setStartPoint(null);
      setCurrentPoint(null);
    }
  }, [isDrawing, map]);

  useMapEvents({
    mousedown(e) {
      if (!isDrawing) return;
      setStartPoint([e.latlng.lat, e.latlng.lng]);
      setCurrentPoint([e.latlng.lat, e.latlng.lng]);
    },
    mousemove(e) {
      if (!isDrawing || !startPoint) return;
      setCurrentPoint([e.latlng.lat, e.latlng.lng]);
    },
    mouseup(e) {
      if (!isDrawing || !startPoint) return;
      const lat1 = startPoint[0];
      const lng1 = startPoint[1];
      const lat2 = e.latlng.lat;
      const lng2 = e.latlng.lng;

      const minLon = Math.min(lng1, lng2);
      const maxLon = Math.max(lng1, lng2);
      const minLat = Math.min(lat1, lat2);
      const maxLat = Math.max(lat1, lat2);

      if (Math.abs(maxLon - minLon) > 0.005 && Math.abs(maxLat - minLat) > 0.005) {
        soundEngine.playBubbleHover();
        onBoxDrawn([
          Number(minLon.toFixed(4)),
          Number(minLat.toFixed(4)),
          Number(maxLon.toFixed(4)),
          Number(maxLat.toFixed(4)),
        ]);
      }
      setStartPoint(null);
      setCurrentPoint(null);
    },
  });

  if (!isDrawing || !startPoint || !currentPoint) return null;

  const minLat = Math.min(startPoint[0], currentPoint[0]);
  const maxLat = Math.max(startPoint[0], currentPoint[0]);
  const minLng = Math.min(startPoint[1], currentPoint[1]);
  const maxLng = Math.max(startPoint[1], currentPoint[1]);

  return (
    <RLPolygon
      positions={[
        [minLat, minLng],
        [minLat, maxLng],
        [maxLat, maxLng],
        [maxLat, minLng],
      ]}
      pathOptions={{
        color: '#FF6600',
        weight: 2,
        opacity: 0.9,
        fillColor: '#FF6600',
        fillOpacity: 0.18,
        dashArray: '4 4',
      }}
    />
  );
}

interface MapViewProps {
  spill: Spill | null;
  vessels: Vessel[];
  tracks: Record<string, VesselTrack>;
  satellite: SatelliteObservation | null;
  selectedVesselId: string | null;
  onSelectVessel: (id: string) => void;
  centerTargetVessel: Vessel | null;
  activeSection?: string;
  onEmptyMapClick: () => void;
  isLight?: boolean;
  onSelectHistoricalSpill?: (detail: HistoricalSpillDetail) => void;
  onNavigateSection?: (section: string) => void;
}

export default function MapView({
  spill,
  vessels,
  tracks,
  satellite,
  selectedVesselId,
  onSelectVessel,
  centerTargetVessel,
  activeSection,
  onEmptyMapClick,
  isLight = false,
  onSelectHistoricalSpill,
  onNavigateSection,
}: MapViewProps) {
  const [toggles, setToggles] = useState<LayerToggles>({
    spill: true,
    drift: true,
    forecast: true,
    ais: true,
    satellite: true,
  });
  const [tileError, setTileError] = useState(false);
  const [latestScan, setLatestScan] = useState<SurveillanceScanResult | null>(null);
  const [targetAoi, setTargetAoi] = useState<{
    bbox: [number, number, number, number];
    label: string;
  } | null>({
    bbox: [71.25, 19.35, 71.55, 19.65],
    label: 'Mumbai High Offshore',
  });

  // Bi-directional bounding box state synchronized with SurveillancePanel
  const [customBbox, setCustomBbox] = useState<[string, string, string, string]>([
    '71.25',
    '19.35',
    '71.55',
    '19.65',
  ]);
  const [isDrawingBox, setIsDrawingBox] = useState(false);

  const toggle = (key: keyof LayerToggles) =>
    setToggles((prev) => ({ ...prev, [key]: !prev[key] }));

  const useMapbox = Boolean(MAPBOX_URL && !tileError);
  const useCarto = Boolean(CARTO_DARK_URL && !tileError);

  // Derived parsed custom bbox for real-time map preview polygon
  const parsedCustomBbox = useMemo(() => {
    const nums = customBbox.map((v) => parseFloat(v));
    if (nums.some(isNaN)) return null;
    return [
      Math.min(nums[0], nums[2]),
      Math.min(nums[1], nums[3]),
      Math.max(nums[0], nums[2]),
      Math.max(nums[1], nums[3]),
    ] as [number, number, number, number];
  }, [customBbox]);

  const handleBoxDrawn = (bbox: [number, number, number, number]) => {
    setCustomBbox([
      bbox[0].toString(),
      bbox[1].toString(),
      bbox[2].toString(),
      bbox[3].toString(),
    ]);
    setIsDrawingBox(false);
  };

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={[spill?.centroid.lat ?? 18.9, spill?.centroid.lng ?? 71.5]}
        zoom={10}
        zoomControl={false}
        attributionControl={false}
        className="h-full w-full"
      >
        {useMapbox ? (
          <TileLayer
            url={MAPBOX_URL!}
            attribution={MAPBOX_ATTRIBUTION}
            maxZoom={19}
            eventHandlers={{ tileerror: () => setTileError(true) }}
          />
        ) : useCarto ? (
          <TileLayer
            url={CARTO_DARK_URL!}
            attribution={CARTO_ATTRIBUTION}
            maxZoom={19}
            eventHandlers={{ tileerror: () => setTileError(true) }}
          />
        ) : (
          <TileLayer
            url={OSM_URL}
            attribution={OSM_ATTRIBUTION}
            subdomains={["a", "b", "c"]}
            maxZoom={19}
            className="maris-dark-osm-tiles"
          />
        )}

        {spill && activeSection !== 'Live Surveillance' && (
          <>
            <FitToSpill spill={spill} />
            <SpillLayer
              spill={spill}
              satellite={satellite}
              showSpill={toggles.spill}
              showDrift={toggles.drift}
              showForecast={toggles.forecast}
              showSatelliteFootprint={toggles.satellite}
            />
          </>
        )}

        {activeSection === 'Live Surveillance' && <FitToScan scan={latestScan} />}

        {activeSection !== 'Live Surveillance' && (
          <ShipTrackLayer
            vessels={vessels}
            tracks={tracks}
            selectedVesselId={selectedVesselId}
            onSelectVessel={onSelectVessel}
            showAis={toggles.ais}
          />
        )}

        <CenterOnVessel vessel={centerTargetVessel} />
        <DeselectOnEmptyMap onEmptyClick={onEmptyMapClick} />

        {/* Live Surveillance Viewport Auto-Focus Controllers */}
        {activeSection === 'Live Surveillance' && (
          <FitToAoi bbox={targetAoi?.bbox ?? null} />
        )}
        <FitToScan scan={latestScan} />

        {/* Interactive Bounding Box Drawer */}
        <BoxDrawHandler isDrawing={isDrawingBox} onBoxDrawn={handleBoxDrawn} />

        {/* Real-time Target Surveillance AOI Bounding Box on Map */}
        {activeSection === 'Live Surveillance' && targetAoi && (
          <RLPolygon
            key={`target-aoi-${targetAoi.bbox.join('-')}`}
            positions={[
              [targetAoi.bbox[1], targetAoi.bbox[0]],
              [targetAoi.bbox[1], targetAoi.bbox[2]],
              [targetAoi.bbox[3], targetAoi.bbox[2]],
              [targetAoi.bbox[3], targetAoi.bbox[0]],
            ]}
            pathOptions={{
              color: '#FF6600',
              weight: 2,
              opacity: 0.85,
              fillColor: '#FF6600',
              fillOpacity: 0.08,
              dashArray: '5 5',
            }}
          >
            <RLTooltip direction="top" permanent>
              <div className="font-mono text-[10px] text-[#FF6600] font-bold">
                🎯 {targetAoi.label} [{targetAoi.bbox.join(', ')}]
              </div>
            </RLTooltip>
          </RLPolygon>
        )}

        {/* Live surveillance detection polygons from Satellite AI Scan */}
        {latestScan?.spills?.map((detectedSpill, idx) => {
          const coords: [number, number][] = detectedSpill.spill_polygon_geojson.coordinates[0].map(
            ([lon, lat]: [number, number]) => [lat, lon] as [number, number]
          );
          return (
            <RLPolygon
              key={`surv-spill-${idx}`}
              positions={coords}
              pathOptions={{
                color: '#EF4444',
                weight: 2,
                opacity: 0.9,
                fillColor: '#EF4444',
                fillOpacity: 0.35,
              }}
            >
              <RLTooltip direction="top" sticky>
                <div className="font-mono text-[11px] font-bold text-red-400 p-1">
                  🚨 OIL SLICK DETECTED
                  <div className="text-[9px] text-white font-normal mt-0.5">
                    Area: <span className="text-red-400 font-bold">{detectedSpill.area_km2} km²</span>
                  </div>
                  <div className="text-[9px] text-white font-normal">
                    Confidence: <span className="text-[#FF6600] font-bold">{(detectedSpill.confidence * 100).toFixed(1)}%</span>
                  </div>
                </div>
              </RLTooltip>
            </RLPolygon>
          );
        })}

        {/* Scanned zone bounding box */}
        {latestScan && (
          <RLPolygon
            positions={[
              [latestScan.aoi_bbox[1], latestScan.aoi_bbox[0]],
              [latestScan.aoi_bbox[1], latestScan.aoi_bbox[2]],
              [latestScan.aoi_bbox[3], latestScan.aoi_bbox[2]],
              [latestScan.aoi_bbox[3], latestScan.aoi_bbox[0]],
            ]}
            pathOptions={{
              color: '#FF6600',
              weight: 1.5,
              opacity: 0.6,
              fillColor: '#FF6600',
              fillOpacity: 0.04,
              dashArray: '6 8',
            }}
          />
        )}
      </MapContainer>

      {/* Layer toggle control */}
      <div className="pointer-events-none absolute left-3 top-3 z-[400] flex flex-col gap-2">
        <div
          className={`pointer-events-auto flex flex-wrap items-center gap-1.5 border p-1.5 shadow-md ${
            isLight
              ? 'bg-white/95 border-black/15 text-[#14161B]'
              : 'bg-[#181B22]/95 border-[#2D323E] text-white'
          }`}
        >
          <span className="flex items-center gap-1 px-1 font-mono text-[11px] font-bold text-[#FF6600]">
            <Layers size={12} /> LAYERS
          </span>
          <ToggleButton active={toggles.spill} onClick={() => toggle('spill')} icon={Droplets} label="Spill" isLight={isLight} />
          <ToggleButton active={toggles.drift} onClick={() => toggle('drift')} icon={Route} label="Backtrack" isLight={isLight} />
          <ToggleButton active={toggles.forecast} onClick={() => toggle('forecast')} icon={TrendingUp} label="Forecast" isLight={isLight} />
          <ToggleButton active={toggles.ais} onClick={() => toggle('ais')} icon={Radio} label="AIS" isLight={isLight} />
          <ToggleButton
            active={toggles.satellite}
            onClick={() => toggle('satellite')}
            icon={SatelliteIcon}
            label="Footprint"
            isLight={isLight}
          />
        </div>
      </div>

      {/* Drawing Mode floating instruction banner */}
      {isDrawingBox && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[500] pointer-events-none bg-[#FF6600] text-black font-mono text-[11px] font-bold px-3 py-1 shadow-lg animate-bounce rounded-sm border border-black/20">
          ✏️ CLICK & DRAG ON MAP TO DEFINE SURVEILLANCE BOUNDING BOX
        </div>
      )}

      {/* Section 1: Live Surveillance Panel with Interactive Draw & AOI Sync */}
      {activeSection === 'Live Surveillance' && (
        <div className="pointer-events-none absolute left-3 top-16 z-[400]">
          <SurveillancePanel
            isLight={isLight}
            onScanComplete={(result) => setLatestScan(result)}
            customBbox={customBbox}
            onCustomBboxChange={setCustomBbox}
            isDrawingBox={isDrawingBox}
            onToggleDrawBox={() => setIsDrawingBox((b) => !b)}
            onOpenHistory={() => onNavigateSection?.('Spill Analysis')}
            onTargetAoiChange={(bbox, label) => setTargetAoi({ bbox, label })}
          />
        </div>
      )}

      {/* Section 2: Historical Spills & Incident Archive Panel */}
      {activeSection === 'Spill Analysis' && (
        <div className="pointer-events-none absolute left-3 top-16 z-[400]">
          <HistoricalSpillsPanel
            isLight={isLight}
            onSelectSpill={(detail) => onSelectHistoricalSpill?.(detail)}
          />
        </div>
      )}

      {/* Active section indicator */}
      {activeSection && (
        <div className="pointer-events-none absolute right-3 top-3 z-[400]">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSection}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.25 }}
              className="border border-[#FF6600]/40 bg-[#FF6600]/15 px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-widest text-[#FF6600] shadow-[0_0_12px_rgba(255,102,0,0.2)]"
            >
              {activeSection}
            </motion.div>
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

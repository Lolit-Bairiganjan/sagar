import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { motion, AnimatePresence } from 'framer-motion';
import { Layers, Droplets, Route, TrendingUp, Radio, Satellite as SatelliteIcon } from 'lucide-react';
import SpillLayer from './SpillLayer';
import ShipTrackLayer from './ShipTrackLayer';
import type { Spill, Vessel, VesselTrack, SatelliteObservation } from '../types';

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
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  label: string;
}) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.04, rotateX: -6 }}
      whileTap={{ scale: 0.95 }}
      style={{ transformPerspective: 300 }}
      className={`flex items-center gap-1.5 rounded border px-2.5 py-1.5 font-mono-tech text-[12px] uppercase tracking-wider transition-colors ${
        active
          ? 'border-accent-cyan/50 bg-accent-cyan/10 text-accent-cyan shadow-glowCyan'
          : 'border-white/10 text-text-muted hover:text-text-secondary'
      }`}
    >
      <Icon size={12} />
      {label}
    </motion.button>
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
}: MapViewProps) {
  const [toggles, setToggles] = useState<LayerToggles>({
    spill: true,
    drift: true,
    forecast: true,
    ais: true,
    satellite: true,
  });
  const [tileError, setTileError] = useState(false);

  const toggle = (key: keyof LayerToggles) =>
    setToggles((t) => ({ ...t, [key]: !t[key] }));

  const useMapbox = Boolean(MAPBOX_URL) && !tileError;
  const useCarto = !useMapbox && Boolean(CARTO_DARK_URL) && !tileError;

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={[20.41, 65.82]}
        zoom={11}
        className="h-full w-full"
        zoomControl={true}
        preferCanvas
      >
        {useMapbox ? (
          <TileLayer
            url={MAPBOX_URL as string}
            attribution={MAPBOX_ATTRIBUTION}
            eventHandlers={{ tileerror: () => setTileError(true) }}
          />
        ) : useCarto ? (
          <TileLayer
            url={CARTO_DARK_URL as string}
            attribution={CARTO_ATTRIBUTION}
            subdomains="abcd"
            maxZoom={20}
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

        {spill && (
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

        <ShipTrackLayer
          vessels={vessels}
          tracks={tracks}
          selectedVesselId={selectedVesselId}
          onSelectVessel={onSelectVessel}
          showAis={toggles.ais}
        />

        <CenterOnVessel vessel={centerTargetVessel} />
        <DeselectOnEmptyMap onEmptyClick={onEmptyMapClick} />
      </MapContainer>

      {/* Layer toggle control */}
      <div className="pointer-events-none absolute left-3 top-3 z-[400] flex flex-col gap-2">
        <div className="glass pointer-events-auto flex flex-wrap gap-1.5 rounded p-1.5">
          <span className="flex items-center gap-1 px-1 font-mono-tech text-[12px] text-text-muted">
            <Layers size={12} /> LAYERS
          </span>
          <ToggleButton active={toggles.spill} onClick={() => toggle('spill')} icon={Droplets} label="Spill" />
          <ToggleButton active={toggles.drift} onClick={() => toggle('drift')} icon={Route} label="Backtrack" />
          <ToggleButton active={toggles.forecast} onClick={() => toggle('forecast')} icon={TrendingUp} label="Forecast" />
          <ToggleButton active={toggles.ais} onClick={() => toggle('ais')} icon={Radio} label="AIS" />
          <ToggleButton
            active={toggles.satellite}
            onClick={() => toggle('satellite')}
            icon={SatelliteIcon}
            label="Footprint"
          />
        </div>
        <div className="glass pointer-events-auto rounded px-2 py-1 font-mono-tech text-[12px] text-text-muted">
          {useMapbox
            ? 'Mapbox dark basemap'
            : useCarto
              ? 'CARTO Dark Matter basemap'
              : 'Token-free dark OpenStreetMap fallback'}
        </div>
      </div>

      {/* Active section indicator — 3D flip badge */}
      {activeSection && (
        <div className="perspective pointer-events-none absolute right-3 top-3 z-[400]">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSection}
              initial={{ opacity: 0, rotateX: -70, y: -8 }}
              animate={{ opacity: 1, rotateX: 0, y: 0 }}
              exit={{ opacity: 0, rotateX: 70, y: 8 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              style={{ transformOrigin: 'top center' }}
              className="glass-cyan rounded px-3 py-1.5 font-mono-tech text-[12px] font-semibold uppercase tracking-widest text-accent-cyan"
            >
              {activeSection}
            </motion.div>
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

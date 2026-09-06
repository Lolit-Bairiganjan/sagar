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

import { soundEngine } from '../utils/soundEngine';

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
  isLight?: boolean;
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
    setToggles((prev) => ({ ...prev, [key]: !prev[key] }));

  const useMapbox = Boolean(MAPBOX_URL && !tileError);
  const useCarto = Boolean(CARTO_DARK_URL && !tileError);

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
        <div
          className={`pointer-events-auto border px-2 py-1 font-mono text-[10px] ${
            isLight
              ? 'bg-white/90 border-black/10 text-[#6B7280]'
              : 'bg-[#181B22]/90 border-[#2D323E] text-[#6B7280]'
          }`}
        >
          {useMapbox
            ? 'Mapbox dark basemap'
            : useCarto
              ? 'CARTO Dark Matter basemap'
              : 'Token-free dark OpenStreetMap fallback'}
        </div>
      </div>

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

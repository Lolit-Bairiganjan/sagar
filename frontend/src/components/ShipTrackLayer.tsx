import { Marker, Polyline, Tooltip, Popup } from 'react-leaflet';
import L from 'leaflet';
import type { Vessel, VesselTrack, RiskLevel } from '../types';

const RISK_COLOR: Record<RiskLevel, string> = {
  CRITICAL: '#F0473D',
  HIGH: '#E8792E',
  MEDIUM: '#F0A93D',
  LOW: '#3DE888',
};

function vesselIcon(vessel: Vessel, isSelected: boolean) {
  const color = vessel.isSuspect && vessel.attribution ? RISK_COLOR[vessel.attribution.risk] : '#F28C28';
  const size = isSelected ? 16 : 12;
  const rotation = vessel.headingDeg;

  return L.divIcon({
    className: '',
    html: `
      <div style="
        width:${size}px;height:${size}px;
        transform:rotate(${rotation}deg);
        filter:drop-shadow(0 0 ${isSelected ? 6 : 3}px ${color});
      ">
        <svg viewBox="0 0 24 24" width="${size}" height="${size}">
          <path d="M12 1 L20 20 L12 16 L4 20 Z" fill="${color}" stroke="${isSelected ? '#fff' : 'none'}" stroke-width="0.5"/>
        </svg>
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

interface ShipTrackLayerProps {
  vessels: Vessel[];
  tracks: Record<string, VesselTrack>;
  selectedVesselId: string | null;
  onSelectVessel: (id: string) => void;
  showAis: boolean;
}

export default function ShipTrackLayer({
  vessels,
  tracks,
  selectedVesselId,
  onSelectVessel,
  showAis,
}: ShipTrackLayerProps) {
  if (!showAis) return null;

  return (
    <>
      {vessels.map((vessel) => {
        const isSelected = vessel.id === selectedVesselId;
        const track = tracks[vessel.id];
        const isDimmed = selectedVesselId !== null && !isSelected;

        return (
          <div key={vessel.id}>
            {track && (
              <Polyline
                positions={track.points.map((p) => [p.location.lat, p.location.lng])}
                pathOptions={{
                  color: vessel.isSuspect && vessel.attribution ? RISK_COLOR[vessel.attribution.risk] : '#F28C28',
                  weight: isSelected ? 2.5 : 1.25,
                  opacity: isDimmed ? 0.15 : isSelected ? 0.9 : 0.45,
                }}
              />
            )}
            <Marker
              position={[vessel.currentLocation.lat, vessel.currentLocation.lng]}
              icon={vesselIcon(vessel, isSelected)}
              opacity={isDimmed ? 0.35 : 1}
              eventHandlers={{ click: () => onSelectVessel(vessel.id) }}
            >
              <Tooltip direction="top" offset={[0, -8]}>
                <div className="font-mono-tech text-[13px] leading-tight">
                  <div className="vessel-tooltip-name font-semibold">{vessel.name}</div>
                  <div className="text-text-secondary">
                    {vessel.speedKn.toFixed(1)} kn · {vessel.headingDeg}°
                  </div>
                </div>
              </Tooltip>
              <Popup>
                <div className="min-w-[180px] font-mono-tech text-[13px] leading-relaxed">
                  <div className="mb-1 font-semibold text-text-primary">{vessel.name}</div>
                  <Row label="IMO" value={vessel.imo} />
                  <Row label="Type" value={vessel.type} />
                  <Row label="Speed" value={`${vessel.speedKn.toFixed(1)} kn`} />
                  <Row label="Heading" value={`${vessel.headingDeg}°`} />
                  {vessel.attribution && (
                    <Row label="Attribution" value={`${vessel.attribution.attributionScorePct}%`} />
                  )}
                </div>
              </Popup>
            </Marker>
          </div>
        );
      })}
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 text-text-secondary">
      <span>{label}</span>
      <span className="text-text-primary">{value}</span>
    </div>
  );
}

import { Polygon, CircleMarker, Polyline, Tooltip, Popup, Marker } from 'react-leaflet';
import L from 'leaflet';
import { formatIndianDateTime, formatIndianTime } from '../utils/time';
import type { Spill, SatelliteObservation } from '../types';

interface SpillLayerProps {
  spill: Spill;
  satellite: SatelliteObservation | null;
  showSpill: boolean;
  showDrift: boolean;
  showForecast: boolean;
  showSatelliteFootprint: boolean;
}

function nodeIcon(label: string, isCurrent?: boolean) {
  return L.divIcon({
    className: '',
    html: `
      <div style="
        display:flex;flex-direction:column;align-items:center;
        font-family:'JetBrains Mono',monospace;
      ">
        <div style="
          width:${isCurrent ? 10 : 7}px;height:${isCurrent ? 10 : 7}px;border-radius:50%;
          background:${isCurrent ? '#F28C28' : '#0A0F17'};
          border:1.5px solid #F28C28;
          box-shadow:${isCurrent ? '0 0 8px rgba(242,140,40,0.8)' : 'none'};
        "></div>
        <span style="
          margin-top:3px;font-size:9px;letter-spacing:0.05em;
          color:${isCurrent ? '#F28C28' : '#7F8EA3'};
          background:rgba(5,8,13,0.75);padding:1px 4px;border-radius:2px;
          white-space:nowrap;
        ">${label}</span>
      </div>
    `,
    iconSize: [40, 30],
    iconAnchor: [isCurrent ? 5 : 3.5, isCurrent ? 5 : 3.5],
  });
}

function originIcon() {
  return L.divIcon({
    className: '',
    html: `
      <div style="position:relative;width:22px;height:22px;">
        <div style="
          position:absolute;inset:0;border-radius:50%;
          border:1.5px solid #F0A93D;opacity:0.55;
        "></div>
        <div style="
          position:absolute;top:50%;left:50%;width:6px;height:6px;
          transform:translate(-50%,-50%);border-radius:50%;
          background:#F0A93D;box-shadow:0 0 8px rgba(240,169,61,0.9);
        "></div>
      </div>
    `,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

export default function SpillLayer({
  spill,
  satellite,
  showSpill,
  showDrift,
  showForecast,
  showSatelliteFootprint,
}: SpillLayerProps) {
  const ring: [number, number][] = spill.polygon.ring.map((p) => [p.lat, p.lng]);
  const backtrackLine: [number, number][] = spill.drift.backtrack.map((n) => [n.location.lat, n.location.lng]);
  const forecastLine: [number, number][] = spill.drift.forecast.map((n) => [n.location.lat, n.location.lng]);
  const footprintRing: [number, number][] | null = satellite
    ? satellite.footprint.corners.map((p) => [p.lat, p.lng])
    : null;

  return (
    <>
      {showSatelliteFootprint && footprintRing && satellite && (
        <Polygon
          positions={footprintRing}
          pathOptions={{
            color: '#F28C28',
            weight: 1,
            opacity: 0.4,
            fillColor: '#F28C28',
            fillOpacity: 0.03,
            dashArray: '4 6',
          }}
        >
          <Tooltip direction="top" sticky>
            <div className="font-mono-tech text-[13px] leading-tight">
              <div className="font-semibold text-accent-cyan">SENTINEL-1 · SAR PASS</div>
              <div>Acquisition: {formatIndianTime(satellite.acquisitionUtc, { hour: '2-digit', minute: '2-digit' })}</div>
              <div>Incidence: {satellite.incidenceAngleDeg}°</div>
              <div>Resolution: {satellite.resolutionM} m</div>
            </div>
          </Tooltip>
        </Polygon>
      )}

      {showSpill && (
        <>
          {/* Outer soft glow ring */}
          <Polygon
            positions={ring}
            pathOptions={{
              color: '#E8792E',
              weight: 0,
              fillColor: '#E8792E',
              fillOpacity: 0.12,
            }}
          />
          {/* Core slick with highlighted border */}
          <Polygon
            positions={ring}
            pathOptions={{
              color: '#F0A93D',
              weight: 1.5,
              opacity: 0.85,
              fillColor: '#E8792E',
              fillOpacity: 0.32,
            }}
          >
            <Popup>
              <div className="min-w-[190px] font-mono-tech text-[13px] leading-relaxed">
                <div className="mb-1 flex items-center gap-1.5 font-semibold tracking-wide text-accent-orange">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent-orange" /> SPILL DETECTED
                </div>
                <Row label="Confidence" value={`${spill.detectionConfidencePct}%`} />
                <Row label="Est. Area" value={`${spill.estimatedAreaKm2} km²`} />
                <Row label="Est. Age" value={`${spill.estimatedAgeHours} hrs`} />
                <Row label="Source" value={spill.detectionSource} />
                <Row label="Observed" value={formatIndianDateTime(spill.observedAtUtc)} />
              </div>
            </Popup>
          </Polygon>

          <CircleMarker
            center={[spill.centroid.lat, spill.centroid.lng]}
            radius={4}
            pathOptions={{ color: '#F0A93D', weight: 2, fillColor: '#F0A93D', fillOpacity: 1 }}
          >
            <Tooltip direction="top">Slick centroid</Tooltip>
          </CircleMarker>
        </>
      )}

      <Marker position={[spill.origin.location.lat, spill.origin.location.lng]} icon={originIcon()}>
        <Tooltip direction="top" permanent className="!bg-transparent !border-0 !shadow-none">
          <span className="font-mono-tech text-[12px] font-semibold uppercase tracking-widest text-accent-amber">
            Estimated Origin
          </span>
        </Tooltip>
        <Popup>
          <div className="font-mono-tech text-[13px] leading-relaxed">
            <div className="mb-1 font-semibold text-accent-amber">ESTIMATED ORIGIN</div>
            <Row label="Confidence" value={`${spill.origin.confidencePct}%`} />
            <Row label="Est. time" value={formatIndianTime(spill.origin.estimatedAtUtc, { hour: '2-digit', minute: '2-digit' })} />
          </div>
        </Popup>
      </Marker>

      {showDrift && (
        <>
          <Polyline
            positions={backtrackLine}
            pathOptions={{ color: '#F28C28', weight: 2, opacity: 0.75, dashArray: '2 8' }}
          />
          {spill.drift.backtrack.map((node) => (
            <Marker
              key={node.label + node.timestampUtc}
              position={[node.location.lat, node.location.lng]}
              icon={nodeIcon(node.label, node.isCurrent)}
            />
          ))}
        </>
      )}

      {showForecast && (
        <>
          <Polyline
            positions={forecastLine}
            pathOptions={{ color: '#F0473D', weight: 2, opacity: 0.7, dashArray: '6 6' }}
          />
          {spill.drift.forecast
            .filter((n) => !n.isCurrent)
            .map((node) => (
              <Marker
                key={node.label + node.timestampUtc}
                position={[node.location.lat, node.location.lng]}
                icon={nodeIcon(node.label)}
              />
            ))}
        </>
      )}
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

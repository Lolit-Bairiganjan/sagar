import jsPDF from 'jspdf';
import type { Spill, Vessel } from '../types';

const INK = { r: 20, g: 26, b: 34 };
const MUTED = { r: 110, g: 120, b: 135 };
const ACCENT = { r: 20, g: 140, b: 150 };
const DANGER = { r: 190, g: 60, b: 50 };

function setColor(doc: jsPDF, c: { r: number; g: number; b: number }) {
  doc.setTextColor(c.r, c.g, c.b);
}

export function generateEvidenceDossier(spill: Spill | null, vessel: Vessel | null): void {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 48;
  let y = 56;

  const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC';

  // -- Header --------------------------------------------------------------
  doc.setFont('courier', 'bold');
  doc.setFontSize(18);
  setColor(doc, INK);
  doc.text('SAGAR', margin, y);
  doc.setFont('courier', 'normal');
  doc.setFontSize(9);
  setColor(doc, MUTED);
  doc.text('SAR-BASED AUTOMATED GEOSPATIAL ANALYSIS FOR RECOGNITION OF OIL SPILLS', margin, y + 14);

  doc.setFont('courier', 'normal');
  doc.setFontSize(8);
  doc.text(`GENERATED ${nowStr}`, pageWidth - margin, y - 4, { align: 'right' });
  doc.text('CLASSIFICATION: SIMULATION / MOCK DATA', pageWidth - margin, y + 8, { align: 'right' });

  y += 26;
  doc.setDrawColor(200, 205, 212);
  doc.line(margin, y, pageWidth - margin, y);
  y += 26;

  const sectionTitle = (title: string) => {
    doc.setFont('courier', 'bold');
    doc.setFontSize(11);
    setColor(doc, ACCENT);
    doc.text(title, margin, y);
    y += 6;
    doc.setDrawColor(210, 214, 220);
    doc.line(margin, y, pageWidth - margin, y);
    y += 16;
  };

  const kv = (label: string, value: string, indent = 0) => {
    doc.setFont('courier', 'normal');
    doc.setFontSize(9);
    setColor(doc, MUTED);
    doc.text(label, margin + indent, y);
    setColor(doc, INK);
    doc.text(value, margin + indent + 150, y);
    y += 14;
  };

  const ensureSpace = (needed: number) => {
    if (y + needed > 780) {
      doc.addPage();
      y = 56;
    }
  };

  // -- Investigation summary -----------------------------------------------
  sectionTitle('INVESTIGATION SUMMARY');
  kv('Investigation ID', spill?.id ?? 'N/A');
  kv('Status', (spill?.status ?? 'UNKNOWN').replace(/_/g, ' '));
  kv('Sector', 'ARABIAN SEA / SECTOR 07');
  kv('Operation', 'OPERATION: BLUE HORIZON');
  y += 8;

  // -- Spill information -----------------------------------------------------
  if (spill) {
    ensureSpace(140);
    sectionTitle('SPILL INFORMATION');
    kv('Detection Confidence', `${spill.detectionConfidencePct}%`);
    kv('Estimated Area', `${spill.estimatedAreaKm2} km2`);
    kv('Estimated Age', `${spill.estimatedAgeHours} hours`);
    kv('Detection Source', spill.detectionSource);
    kv('Observation Time', spill.observedAtUtc);
    kv('Centroid', `${spill.centroid.lat.toFixed(4)}, ${spill.centroid.lng.toFixed(4)}`);
    y += 8;

    ensureSpace(120);
    sectionTitle('SATELLITE OBSERVATION');
    kv('Platform', 'Sentinel-1');
    kv('Sensor', 'SAR (C-band)');
    kv('Acquisition', spill.observedAtUtc);
    kv('Resolution', '10 m');
    y += 8;

    ensureSpace(140);
    sectionTitle('SPILL GEOMETRY & ORIGIN');
    kv('Polygon Vertices', String(spill.polygon.ring.length));
    kv('Estimated Origin', `${spill.origin.location.lat.toFixed(4)}, ${spill.origin.location.lng.toFixed(4)}`);
    kv('Origin Confidence', `${spill.origin.confidencePct}%`);
    kv('Origin Est. Time', spill.origin.estimatedAtUtc);
    y += 8;

    ensureSpace(140);
    sectionTitle('HINDCAST / FORECAST');
    spill.drift.backtrack.forEach((node) => {
      kv(`Backtrack ${node.label}`, `${node.location.lat.toFixed(3)}, ${node.location.lng.toFixed(3)}`);
    });
    spill.drift.forecast
      .filter((n) => !n.isCurrent)
      .forEach((node) => {
        kv(`Forecast ${node.label}`, `${node.location.lat.toFixed(3)}, ${node.location.lng.toFixed(3)}`);
      });
    y += 8;
  }

  // -- Selected vessel evidence ----------------------------------------------
  if (vessel) {
    const attr = vessel.attribution;
    ensureSpace(240);
    sectionTitle('SELECTED VESSEL EVIDENCE');
    doc.setFont('courier', 'bold');
    doc.setFontSize(10);
    setColor(doc, attr?.risk === 'CRITICAL' || attr?.risk === 'HIGH' ? DANGER : INK);
    doc.text(`${vessel.name}  (IMO ${vessel.imo})`, margin, y);
    y += 18;
    kv('Vessel Type', vessel.type, 12);
    kv('Flag', vessel.flag, 12);
    kv('Speed', `${vessel.speedKn.toFixed(1)} knots`, 12);
    kv('Heading', `${vessel.headingDeg}°`, 12);
    if (attr) {
      kv('Attribution Score', `${attr.attributionScorePct}%`, 12);
      kv('Risk Level', attr.risk, 12);
      kv('Distance', `${attr.distanceNm} NM`, 12);
      kv('Time Difference', `+${attr.timeDifferenceMinutes} min`, 12);
      kv('Trajectory Match', `${attr.trajectoryMatchPct}%`, 12);
      kv('Behavior Anomaly', attr.behaviorAnomaly, 12);
      y += 4;
      doc.setFont('courier', 'bold'); doc.setFontSize(9); setColor(doc, ACCENT);
      doc.text('AIS CORRELATION', margin + 12, y); y += 14;
      kv('Spatial', `${attr.correlation.spatialPct}%`, 24);
      kv('Temporal', `${attr.correlation.temporalPct}%`, 24);
      kv('Trajectory', `${attr.correlation.trajectoryPct}%`, 24);
      kv('Behavior', `${attr.correlation.behaviorPct}%`, 24);
      kv('Overall', `${attr.correlation.overallPct}%`, 24);
    }
    if (vessel.anomalyEvents.length > 0) {
      ensureSpace(30 + vessel.anomalyEvents.length * 24);
      doc.setFont('courier', 'bold'); doc.setFontSize(9); setColor(doc, ACCENT);
      doc.text('BEHAVIOR ANOMALIES', margin + 12, y); y += 14;
      vessel.anomalyEvents.forEach((event) => {
        doc.setFont('courier', 'normal'); doc.setFontSize(8); setColor(doc, MUTED);
        const time = event.timestampUtc.substring(11, 16);
        doc.text(`${time} UTC  ${event.label}`, margin + 24, y); y += 11;
        setColor(doc, INK);
        const wrapped = doc.splitTextToSize(event.description, pageWidth - margin * 2 - 24);
        doc.text(wrapped, margin + 24, y); y += wrapped.length * 11 + 4;
      });
    }
    y += 8;
  }

  // -- Evidence summary --------------------------------------------------
  ensureSpace(120);
  sectionTitle('EVIDENCE SUMMARY');
  doc.setFont('courier', 'normal');
  doc.setFontSize(9);
  setColor(doc, INK);
  const summary = vessel
    ? `This dossier is limited to the selected vessel ${vessel.name} (IMO ${vessel.imo})${vessel.attribution ? `, with an attribution confidence of ${vessel.attribution.attributionScorePct}%` : ''}. The evidence shown here is based on spatial proximity, temporal correlation, trajectory analysis, and observed AIS behavior in the investigation window surrounding the satellite detection at ${spill?.observedAtUtc ?? 'N/A'}. This dossier is generated entirely from mock frontend data for demonstration purposes and does not represent a real environmental or legal finding.`
    : 'No vessel was selected for this dossier.';
  const wrappedSummary = doc.splitTextToSize(summary, pageWidth - margin * 2);
  doc.text(wrappedSummary, margin, y);
  y += wrappedSummary.length * 12 + 20;

  // -- Footer on every page --------------------------------------------------
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont('courier', 'normal');
    doc.setFontSize(7.5);
    setColor(doc, MUTED);
    doc.text(
      `SAGAR EVIDENCE DOSSIER — ${spill?.id ?? 'N/A'} — PAGE ${i} OF ${pageCount} — GENERATED FROM SIMULATION DATA`,
      margin,
      820,
    );
  }

  doc.save(`SAGAR-Evidence-Dossier-${vessel?.imo ?? 'selected-vessel'}-${spill?.id ?? 'draft'}.pdf`);
}

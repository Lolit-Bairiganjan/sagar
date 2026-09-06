# SAGAR — SAR-based Automated Geospatial Analysis for Recognition of oil spills

A frontend-only prototype of a marine oil spill detection and AIS vessel
attribution intelligence platform, built for the **NTRO Disaster Management**
hackathon track.

This app visualizes: satellite-detected oil slicks, spill geometry and
estimated area, drift hindcast/forecast, AIS vessel tracks, a ranked suspect
vessel list with an attribution scoring breakdown, behavior anomaly
timelines, and a one-click PDF evidence dossier — all driven by realistic
**mock data**, ready to be wired to a real backend later.

> This repo contains **frontend only**. No ML, no satellite processing, no
> AIS ingestion, no FastAPI service — those are out of scope by design. See
> "Connecting the real backend" below.

---

## 1. Technology stack

| Layer | Choice |
|---|---|
| Framework | React 18 + TypeScript |
| Build tool | Vite |
| Styling | Tailwind CSS |
| Map | Leaflet + react-leaflet (token-free dark fallback, optional CARTO/Mapbox) |
| Animation | Framer Motion |
| Icons | lucide-react |
| PDF export | jsPDF |
| HTTP | Axios (wired for a future FastAPI backend) |

---

## 2. Installation

```bash
cd frontend
npm install
npm run dev
```

The app runs at `http://localhost:5173`.

```bash
npm run build     # type-check + production build to dist/
npm run preview   # preview the production build locally
```

---

## 3. Environment variables

Copy `.env.example` to `.env.local` and adjust as needed. On Windows PowerShell you can use `Copy-Item .env.example .env.local`:

```bash
cp .env.example .env.local
```

| Variable | Purpose | Default behavior if unset |
|---|---|---|
| `VITE_CARTO_BASEMAP_KEY` | Optional free CARTO basemap key for Dark Matter tiles | If empty, the app uses a token-free dark OpenStreetMap fallback. |
| `VITE_MAPBOX_TOKEN` | Optional Mapbox **public (`pk.`)** access token for the `dark-v11` map style | Never put a secret (`sk.`) token in a Vite frontend. |
| `VITE_API_BASE_URL` | Base URL of the future FastAPI backend | `http://localhost:8000/api` |
| `VITE_USE_MOCK` | `true` (default) uses local mock data; `false` calls the real backend | `true` |

---

## 4. Folder structure

```
frontend/
├── src/
│   ├── main.tsx
│   ├── App.tsx                  # layout orchestration + data loading
│   │
│   ├── components/
│   │   ├── TopBar.tsx            # command header, status, UTC clock
│   │   ├── NavSidebar.tsx        # left nav + system status
│   │   ├── MapView.tsx           # Leaflet map, tile fallback, layer toggles
│   │   ├── SpillLayer.tsx        # slick polygon, origin, drift hindcast/forecast
│   │   ├── ShipTrackLayer.tsx    # AIS vessel markers + historical tracks
│   │   ├── Sidebar.tsx           # ranked suspect vessel cards
│   │   ├── IntelligencePanel.tsx # right panel: investigation / vessel dossier
│   │   ├── AttributionScore.tsx  # animated score breakdown bars
│   │   ├── OceanDataPanel.tsx    # wind / current / sea state / temperature
│   │   ├── BottomTimeline.tsx    # playback scrubber
│   │   ├── StartupScreen.tsx     # boot / system-check splash
│   │   └── DossierButton.tsx     # triggers the PDF export
│   │
│   ├── api/
│   │   └── client.ts             # all data-fetching functions (mock ⇄ real)
│   │
│   ├── types/
│   │   └── index.ts              # shared TS interfaces (FastAPI/Pydantic-ready)
│   │
│   └── utils/
│       └── pdfGenerator.ts       # jsPDF dossier builder
│
├── public/
├── index.html
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── .env.example
└── README.md
```

---

## 5. Mock API architecture

Every screen reads data through the functions in `src/api/client.ts`:

```ts
getSpillData()
getVessels()
getVesselTrack(vesselId)
getSatelliteData()
getOceanographicData()
getInvestigation()
getSystemStatus()
```

No component ever imports mock data directly — they only call these
functions and get back typed `Promise`s. Internally, each function checks
`VITE_USE_MOCK`:

- **`true` (default):** returns realistic mock data (with an artificial
  network delay) so the UI feels alive during development.
- **`false`:** calls the real endpoint via the shared `axios` instance
  (`apiClient`), pointed at `VITE_API_BASE_URL`.

This means the FastAPI backend can be dropped in later with **zero changes**
to any React component.

---

## 6. Connecting the real FastAPI backend later

1. Stand up FastAPI endpoints that match the shapes in `src/types/index.ts`
   (they're written to map cleanly onto Pydantic models):
   `GET /spill`, `GET /vessels`, `GET /vessels/{id}/track`,
   `GET /satellite`, `GET /ocean`, `GET /investigation`, `GET /system-status`.
2. Set `VITE_API_BASE_URL` to the backend's base URL.
3. Set `VITE_USE_MOCK=false`.
4. Restart the dev server. That's it — no component code changes.

---

## 7. Replacing mock data

All mock data lives inside `src/api/client.ts` in a handful of `getMock*()`
functions and two small lookup tables (`MOCK_TRACK_OFFSETS`). To adjust the
demo scenario (different spill location, more vessels, different attribution
scores), edit those functions directly — the rest of the app reads whatever
shape they return, so nothing else needs to change as long as the
TypeScript types in `src/types/index.ts` are respected.

---

## 8. Generating the evidence dossier

Click **"Generate Evidence Dossier"** at the bottom of the right-hand
Intelligence Panel. This calls `generateEvidenceDossier()` in
`src/utils/pdfGenerator.ts`, which builds a multi-section PDF entirely from
in-memory state (spill info, satellite observation, geometry & origin,
hindcast/forecast, suspect ranking, attribution breakdown, AIS correlation,
and behavior anomaly timelines) and triggers a browser download. No network
call or backend is involved — it works purely off whatever is currently
loaded in the app.

---

## 9. Notes

- All vessel names, IMO numbers, and attribution scores are **fictional**
  and generated for demonstration purposes only.
- The app is designed to degrade gracefully: missing map tokens, empty
  data, or a failed fetch all produce readable in-UI messaging rather than
  a crash.
- Built desktop-first for 1440×900, responsive down through laptop/tablet;
  side panels collapse progressively as the viewport narrows.

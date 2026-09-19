import threading

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes import investigations, spills, surveillance, weather
from app.services.drift import backfill_missing_drift_estimates, ensure_database_compatibility

app = FastAPI(title="SIH26143 — Maritime Oil Spill & AIS Correlation API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount routers at both root and /api for seamless frontend compatibility
app.include_router(investigations.router)
app.include_router(investigations.router, prefix="/api")
app.include_router(spills.router)
app.include_router(spills.router, prefix="/api")
app.include_router(surveillance.router)
app.include_router(surveillance.router, prefix="/api")
app.include_router(weather.router)


def _run_background_backfill() -> None:
    try:
        backfill_missing_drift_estimates(limit=25)
    except Exception:
        pass


@app.on_event("startup")
def startup() -> None:
    ensure_database_compatibility()
    threading.Thread(target=_run_background_backfill, daemon=True).start()


@app.get("/health")
@app.get("/api/health")
def health():
    return {"status": "ok"}
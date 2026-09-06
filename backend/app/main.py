from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes import investigations, spills

app = FastAPI(title="SIH26143 — Maritime Oil Spill & AIS Correlation API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(investigations.router)
app.include_router(spills.router)


@app.get("/health")
def health():
    return {"status": "ok"}
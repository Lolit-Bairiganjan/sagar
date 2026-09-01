from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes.suspects import router as suspects_router

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(suspects_router)


@app.get("/")
def root():
    return {"status": "ok"}


@app.get("/api/spills")
def get_spills():
    return {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [88.3, 21.6]},
                "properties": {"id": 1, "confidence": 0.87, "suspect_vessel": "MV Example"}
            }
        ]
    }
"""
weather.py — FastAPI routes for live and historical weather / oceanographic conditions.
"""

from typing import Optional
from fastapi import APIRouter, Query, HTTPException
from pydantic import BaseModel

from app.services.weather_service import get_historical_weather

router = APIRouter(prefix="/api/weather", tags=["weather"])


class WeatherRequest(BaseModel):
    lat: float
    lon: float
    date: Optional[str] = None


@router.get("/historical")
def query_historical_weather(
    lat: float = Query(..., description="Latitude of target spill or ocean point"),
    lon: float = Query(..., description="Longitude of target spill or ocean point"),
    date: Optional[str] = Query(None, description="ISO date or timestamp (e.g. 2020-08-06)"),
):
    """
    Returns historical or live weather and marine drift conditions
    (wind speed/dir, current speed/dir, wave height, sea temp)
    using persistent local storage and Open-Meteo archive.
    """
    try:
        return get_historical_weather(lat, lon, date or "")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve weather: {e}") from e


@router.post("/query")
def post_weather_query(req: WeatherRequest):
    """
    POST equivalent for querying weather and marine conditions.
    """
    try:
        return get_historical_weather(req.lat, req.lon, req.date or "")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve weather: {e}") from e


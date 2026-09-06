from pydantic import BaseModel
from typing import List, Any, Dict
from datetime import datetime


class Suspect(BaseModel):
    name: str
    mmsi: int
    min_distance_m: float
    distance_score: float
    time_score: float
    suspicion_score: float


class SuspectListResponse(BaseModel):
    spill_id: int
    suspects: List[Suspect]


class SpillInput(BaseModel):
    """
    Payload the ML/remote-sensing pipeline sends when it detects a new spill.
    Confirm field names/types match what Members 1 & 2 actually output.
    """
    centroid_lat: float
    centroid_lon: float
    detected_at: datetime
    spill_polygon_geojson: Dict[str, Any]  # GeoJSON Polygon of the detected slick
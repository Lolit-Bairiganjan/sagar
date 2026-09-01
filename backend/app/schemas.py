from pydantic import BaseModel
from typing import List


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
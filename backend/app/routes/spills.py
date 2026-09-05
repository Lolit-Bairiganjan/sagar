from fastapi import APIRouter, HTTPException

from app.schemas import SpillInput
from app.queries.spills import insert_spill
from app.services.drift import process_new_spill

router = APIRouter(tags=["spills"])


@router.post("/spills")
def create_spill(spill_data: SpillInput):
    """Inserts a new spill and immediately triggers reverse-drift estimation."""
    try:
        spill_id = insert_spill(spill_data)
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to insert spill") from e

    try:
        process_new_spill(
            spill_id,
            spill_data.centroid_lat,
            spill_data.centroid_lon,
            spill_data.detected_at,
        )
    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail=f"Spill {spill_id} created but drift estimation failed: {e}",
        ) from e

    return {"spill_id": spill_id, "status": "created"}
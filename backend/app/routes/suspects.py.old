from fastapi import APIRouter, HTTPException
from app.queries.spatial_correlation import get_suspects_for_spill
from app.schemas import SuspectListResponse

router = APIRouter()


@router.get("/api/suspects", response_model=SuspectListResponse)
def get_suspects(spill_id: int):
    """
    Given a spill_id, returns a ranked list of suspect vessels.
    Example: GET /api/suspects?spill_id=1
    """
    results = get_suspects_for_spill(spill_id)

    if not results:
        raise HTTPException(
            status_code=404,
            detail=f"No suspects found for spill_id={spill_id} (or spill_id does not exist).",
        )

    return {"spill_id": spill_id, "suspects": results}
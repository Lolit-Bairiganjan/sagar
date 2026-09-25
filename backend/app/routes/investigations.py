from fastapi import APIRouter, HTTPException

from app.queries.suspects import AISCoverageError, get_suspects

router = APIRouter(prefix="/investigations", tags=["investigations"])


@router.get("/{spill_id}/suspects")
def suspects(spill_id: int):
    """Returns ranked suspect vessels for a spill. Missing AIS coverage is surfaced explicitly."""
    try:
        rows = get_suspects(spill_id)
    except AISCoverageError as e:
        raise HTTPException(status_code=409, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to fetch suspects") from e

    return {"spill_id": spill_id, "candidates": rows}
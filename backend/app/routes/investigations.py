from fastapi import APIRouter, HTTPException

from app.queries.suspects import get_suspects

router = APIRouter(prefix="/investigations", tags=["investigations"])


@router.get("/{spill_id}/suspects")
def suspects(spill_id: int):
    """Returns ranked suspect vessels for a spill. Zero suspects is a valid result."""
    try:
        rows = get_suspects(spill_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to fetch suspects") from e

    return {"spill_id": spill_id, "candidates": rows}
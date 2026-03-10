from fastapi import APIRouter

from api.services.cgc_service import cgc_service

router = APIRouter(prefix="/api/stats", tags=["stats"])


@router.get("")
def get_stats() -> dict[str, int]:
    return cgc_service.stats()

from fastapi import APIRouter

from api.services.cgc_service import cgc_service

router = APIRouter(prefix="/api/search", tags=["search"])


@router.get("")
def search(q: str, type: str = "all", repo: str | None = None) -> list[dict]:
    return cgc_service.search(q, type, repo)

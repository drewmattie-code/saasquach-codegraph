from fastapi import APIRouter, Query

from api.services.cgc_service import cgc_service

router = APIRouter(prefix="/api/graph", tags=["graph"])


@router.get("")
def graph(repo: str = "all", limit: int = Query(default=500, le=2000)) -> dict:
    return cgc_service.graph(repo, limit)


@router.get("/node/{node_id}")
def node(node_id: int) -> dict:
    return cgc_service.node_detail(node_id)

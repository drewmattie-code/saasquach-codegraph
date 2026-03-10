from fastapi import APIRouter
from pydantic import BaseModel

from api.services.cgc_service import cgc_service

router = APIRouter(prefix="/api/repos", tags=["repos"])


class IndexRequest(BaseModel):
    path: str


@router.get("")
def list_repositories() -> list[dict]:
    return cgc_service.list_repos()


@router.post("/index")
def index_repository(payload: IndexRequest) -> dict:
    return cgc_service.index_repo(payload.path)


@router.delete("/{name}")
def remove_repository(name: str) -> dict:
    return cgc_service.remove_repo(name)


@router.get("/{name}/stats")
def repository_stats(name: str) -> dict:
    return cgc_service.repo_stats(name)

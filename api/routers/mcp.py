from fastapi import APIRouter

from api.services.mcp_service import mcp_service

router = APIRouter(prefix="/api/mcp", tags=["mcp"])


@router.get("/status")
def status() -> dict:
    return mcp_service.status()


@router.post("/start")
def start() -> dict:
    return mcp_service.start()


@router.post("/stop")
def stop() -> dict:
    return mcp_service.stop()


@router.get("/config/{provider}")
def config(provider: str) -> dict:
    return mcp_service.provider_config(provider)

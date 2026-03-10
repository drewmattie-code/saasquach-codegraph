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


@router.post("/restart")
def restart() -> dict:
    return mcp_service.restart()


@router.get("/config/{provider}")
def config(provider: str) -> dict:
    return mcp_service.provider_config(provider)


@router.post("/test/{provider}")
def test(provider: str) -> dict:
    return mcp_service.test(provider)

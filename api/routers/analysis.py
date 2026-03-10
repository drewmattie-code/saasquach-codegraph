from fastapi import APIRouter

from api.services.cgc_service import cgc_service

router = APIRouter(prefix="/api/analysis", tags=["analysis"])


@router.get("/dead-code")
def dead_code() -> dict:
    return cgc_service.dead_code()


@router.get("/complexity")
def complexity() -> list[dict]:
    return cgc_service.complexity()


@router.get("/calls/{name}")
def calls(name: str) -> list[dict]:
    return cgc_service.calls(name)


@router.get("/callers/{name}")
def callers(name: str) -> list[dict]:
    return cgc_service.callers(name)


@router.get("/chain")
def chain(from_function: str, to_function: str) -> list[dict]:
    return cgc_service.chain(from_function, to_function)

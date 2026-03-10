from __future__ import annotations

import asyncio
import os
from datetime import datetime
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from api.routers import analysis, graph, mcp, repos, search, stats
from api.services.cgc_service import cgc_service
from api.services.ws_service import indexing_ws, mcp_ws

app = FastAPI(title="SaaSquach CodeGraph API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(stats.router)
app.include_router(repos.router)
app.include_router(graph.router)
app.include_router(search.router)
app.include_router(analysis.router)
app.include_router(mcp.router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.websocket("/ws/indexing")
async def indexing_feed(websocket: WebSocket) -> None:
    await indexing_ws.connect(websocket)
    try:
        while True:
            jobs = cgc_service.jobs()
            await indexing_ws.broadcast({"type": "indexing", "at": datetime.now().isoformat(), "jobs": jobs})
            await asyncio.sleep(1.5)
    except WebSocketDisconnect:
        await indexing_ws.disconnect(websocket)


@app.websocket("/ws/mcp-activity")
async def mcp_feed(websocket: WebSocket) -> None:
    await mcp_ws.connect(websocket)
    i = 0
    try:
        while True:
            i += 1
            await mcp_ws.broadcast(
                {
                    "type": "mcp.activity",
                    "at": datetime.now().isoformat(),
                    "line": f"[{datetime.now().strftime('%H:%M:%S')}] MCP heartbeat #{i}",
                }
            )
            await asyncio.sleep(2)
    except WebSocketDisconnect:
        await mcp_ws.disconnect(websocket)


# Serve built React app — must be last, catches all unmatched routes
_dist = Path(__file__).parent.parent / "ui" / "dist"
if _dist.exists():
    app.mount("/", StaticFiles(directory=str(_dist), html=True), name="static")

from __future__ import annotations

import asyncio
from collections import deque
from typing import Any

from fastapi import WebSocket


class WSManager:
    def __init__(self, max_history: int = 100) -> None:
        self.connections: set[WebSocket] = set()
        self.history: deque[dict[str, Any]] = deque(maxlen=max_history)
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            self.connections.add(websocket)
            history = list(self.history)
        for event in history:
            await websocket.send_json(event)

    async def disconnect(self, websocket: WebSocket) -> None:
        async with self._lock:
            self.connections.discard(websocket)

    async def broadcast(self, event: dict[str, Any]) -> None:
        async with self._lock:
            self.history.append(event)
            clients = list(self.connections)
        stale: list[WebSocket] = []
        for client in clients:
            try:
                await client.send_json(event)
            except Exception:
                stale.append(client)
        if stale:
            async with self._lock:
                for client in stale:
                    self.connections.discard(client)


indexing_ws = WSManager(max_history=200)
mcp_ws = WSManager(max_history=200)

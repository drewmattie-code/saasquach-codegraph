from __future__ import annotations

import os
import signal
import subprocess
from dataclasses import dataclass
from typing import Any


@dataclass
class MCPState:
    process: subprocess.Popen[str] | None = None
    port: int = 3000


class MCPService:
    def __init__(self) -> None:
        self.state = MCPState()

    def status(self) -> dict[str, Any]:
        running = self.state.process is not None and self.state.process.poll() is None
        return {
            "running": running,
            "port": self.state.port,
            "clients": 0,
            "tools": 5,
        }

    def start(self, port: int = 3000) -> dict[str, Any]:
        if self.status()["running"]:
            return self.status()

        env = os.environ.copy()
        cmd = ["python", "-m", "codegraphcontext.server"]
        self.state.port = port
        self.state.process = subprocess.Popen(cmd, env=env, text=True)
        return self.status()

    def stop(self) -> dict[str, Any]:
        process = self.state.process
        if process is None or process.poll() is not None:
            self.state.process = None
            return self.status()

        process.send_signal(signal.SIGTERM)
        self.state.process = None
        return self.status()

    @staticmethod
    def provider_config(provider: str) -> dict[str, Any]:
        return {
            "provider": provider,
            "snippet": {
                "mcpServers": {
                    "codegraphcontext": {
                        "command": "python",
                        "args": ["-m", "codegraphcontext.server"],
                        "env": {"DATABASE_TYPE": "falkordb"},
                    }
                }
            },
        }


mcp_service = MCPService()

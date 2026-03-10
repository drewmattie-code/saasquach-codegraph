#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"

cleanup() {
  kill 0
}
trap cleanup EXIT INT TERM

cd "$ROOT"
source .venv/bin/activate
python -m uvicorn api.main:app --host 0.0.0.0 --port 7478 &

cd "$ROOT/ui"
npm run dev -- --host 0.0.0.0 --port 7476 &

wait

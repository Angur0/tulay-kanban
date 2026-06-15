#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_PID=""
FRONTEND_PID=""

cleanup() {
    if [[ -n "${FRONTEND_PID}" ]] && kill -0 "${FRONTEND_PID}" 2>/dev/null; then
        kill "${FRONTEND_PID}" 2>/dev/null || true
    fi

    if [[ -n "${BACKEND_PID}" ]] && kill -0 "${BACKEND_PID}" 2>/dev/null; then
        kill "${BACKEND_PID}" 2>/dev/null || true
    fi

    echo "Closing firewall port 8000..."
    sudo ufw delete allow 8000 >/dev/null 2>&1 || true
}

trap cleanup EXIT INT TERM

command -v python >/dev/null 2>&1 || {
    echo "python is required but was not found in PATH." >&2
    exit 1
}

command -v npm >/dev/null 2>&1 || {
    echo "npm is required but was not found in PATH." >&2
    exit 1
}

if [[ ! -f "${ROOT_DIR}/venv/bin/activate" ]]; then
    echo "venv/bin/activate is missing. Create the project virtual environment first." >&2
    exit 1
fi

if [[ ! -d "${ROOT_DIR}/frontend/node_modules" ]]; then
    echo "frontend/node_modules is missing. Run 'cd frontend && npm install' first." >&2
    exit 1
fi

echo "Opening firewall port 8000 for local network access..."
sudo ufw allow 8000 >/dev/null 2>&1 || true

echo "Starting Tulay Kanban backend on http://localhost:8000 ..."
(
    # Activate the project venv so Python dependencies resolve from the repo environment.
    # shellcheck disable=SC1091
    source "${ROOT_DIR}/venv/bin/activate"
    cd "${ROOT_DIR}" && python main.py
) &
BACKEND_PID=$!

sleep 2

echo "Starting Tulay Kanban frontend on http://localhost:5173 ..."
(
    cd "${ROOT_DIR}/frontend" && npm run dev -- --host 0.0.0.0
) &
FRONTEND_PID=$!

wait "${BACKEND_PID}" "${FRONTEND_PID}"

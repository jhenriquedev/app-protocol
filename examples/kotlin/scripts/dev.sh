#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA_DIR="${APP_KOTLIN_DATA_DIR:-"$ROOT_DIR/.tmp/dev-data"}"

mkdir -p "$DATA_DIR"

cd "$ROOT_DIR"

APP_KOTLIN_DATA_DIR="$DATA_DIR" API_PORT="${API_PORT:-3000}" ./gradlew --no-daemon runBackendServer &
BACKEND_PID=$!

APP_KOTLIN_DATA_DIR="$DATA_DIR" AGENT_PORT="${AGENT_PORT:-3001}" ./gradlew --no-daemon runAgentServer &
AGENT_PID=$!

./gradlew --no-daemon runPortalDev &
PORTAL_PID=$!

cleanup() {
  kill "$BACKEND_PID" "$AGENT_PID" "$PORTAL_PID" 2>/dev/null || true
}

trap cleanup EXIT INT TERM

wait

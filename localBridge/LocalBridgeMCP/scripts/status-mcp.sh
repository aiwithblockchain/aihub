#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="$PROJECT_ROOT/logs"
PID_FILE="$LOG_DIR/localbridge-mcp.pid"

if [ ! -f "$PID_FILE" ]; then
  echo "LocalBridgeMCP is not running"
  exit 1
fi

PID="$(cat "$PID_FILE")"

if [ -z "$PID" ]; then
  echo "PID file is empty: $PID_FILE" >&2
  exit 1
fi

if ! kill -0 "$PID" 2>/dev/null; then
  echo "LocalBridgeMCP PID file exists but process $PID is not running"
  exit 1
fi

echo "LocalBridgeMCP is running with PID $PID"

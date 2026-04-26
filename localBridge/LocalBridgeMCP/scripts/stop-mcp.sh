#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="$PROJECT_ROOT/logs"
PID_FILE="$LOG_DIR/localbridge-mcp.pid"

if [ ! -f "$PID_FILE" ]; then
  echo "PID file not found: $PID_FILE" >&2
  exit 1
fi

PID="$(cat "$PID_FILE")"

if [ -z "$PID" ]; then
  echo "PID file is empty: $PID_FILE" >&2
  exit 1
fi

if ! kill -0 "$PID" 2>/dev/null; then
  echo "Process $PID is not running." >&2
  rm -f "$PID_FILE"
  exit 1
fi

kill "$PID"
rm -f "$PID_FILE"

echo "Stopped LocalBridgeMCP process $PID"

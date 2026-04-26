#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="$PROJECT_ROOT/logs"
LOG_FILE="${1:-$LOG_DIR/localbridge-mcp.log}"
PID_FILE="$LOG_DIR/localbridge-mcp.pid"

mkdir -p "$LOG_DIR"

if [ ! -f "$PROJECT_ROOT/dist/index.js" ]; then
  echo "dist/index.js not found. Run 'npm run build' first." >&2
  exit 1
fi

printf '\n[%s] starting LocalBridgeMCP\n' "$(date '+%Y-%m-%d %H:%M:%S')" >> "$LOG_FILE"
printf '[%s] log file: %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$LOG_FILE" >> "$LOG_FILE"
printf '%s\n' $$ > "$PID_FILE"

cleanup() {
  rm -f "$PID_FILE"
}
trap cleanup EXIT

exec node "$PROJECT_ROOT/dist/index.js" 2>> "$LOG_FILE"

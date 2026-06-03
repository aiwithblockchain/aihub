#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
OUT_DIR="$ROOT_DIR/lib"
LIB_NAME="LocalBridgeCore"
UNIVERSAL_LIB="$OUT_DIR/lib${LIB_NAME}.a"

mkdir -p "$OUT_DIR"

cd "$ROOT_DIR"

# 使用临时目录存放中间产品
TMP_DIR=$(mktemp -d)
trap "rm -rf $TMP_DIR" EXIT

build_archive() {
  local goarch="$1"
  local suffix="$2"

  echo "🏗️  Building $LIB_NAME-$suffix.a"
  CGO_ENABLED=1 GOOS=darwin GOARCH="$goarch" \
    go build -buildmode=c-archive \
    -o "$TMP_DIR/$LIB_NAME-$suffix.a" \
    ./cmd/rust-bridge
}

build_archive arm64 arm64
build_archive amd64 x86_64

# 复制头文件（最终交付物）
cp "$TMP_DIR/$LIB_NAME-arm64.h" "$OUT_DIR/$LIB_NAME.h"

echo "📦 Creating universal lib${LIB_NAME}.a"
lipo -create \
  "$TMP_DIR/$LIB_NAME-arm64.a" \
  "$TMP_DIR/$LIB_NAME-x86_64.a" \
  -output "$UNIVERSAL_LIB"

lipo -info "$UNIVERSAL_LIB"
echo "✅ Done: $UNIVERSAL_LIB"

#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
OUT_DIR="$ROOT_DIR/lib"
FW_NAME="LocalBridge"
FW_DIR="$OUT_DIR/$FW_NAME.framework"

echo "🔨 Building Go c-archive..."
mkdir -p "$OUT_DIR"

cd "$ROOT_DIR"

# 编译为静态 C 库（同时生成 .h 头文件）
# 导出 arm64 架构供真机/新款 Mac 调试
CGO_ENABLED=1 GOOS=darwin GOARCH=arm64 \
  go build -buildmode=c-archive \
  -o "$OUT_DIR/${FW_NAME}.a" \
  ./cmd/localbridge

echo "📦 Assembling macOS Framework..."
rm -rf "$FW_DIR"
mkdir -p "$FW_DIR/Versions/A/Headers"

# 复制静态库和头文件
cp "$OUT_DIR/${FW_NAME}.a" "$FW_DIR/Versions/A/${FW_NAME}"
cp "$OUT_DIR/${FW_NAME}.h" "$FW_DIR/Versions/A/Headers/${FW_NAME}.h"

# 创建 Framework 符号链接（标准结构要求）
ln -sf Versions/A/Headers "$FW_DIR/Headers"
ln -sf Versions/A/${FW_NAME} "$FW_DIR/${FW_NAME}"
ln -sf A "$FW_DIR/Versions/Current"

# 写入 Info.plist
mkdir -p "$FW_DIR/Versions/A/Resources"
cat > "$FW_DIR/Versions/A/Resources/Info.plist" << 'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleIdentifier</key><string>com.localbridge.golib</string>
  <key>CFBundleName</key><string>LocalBridge</string>
  <key>CFBundleVersion</key><string>0.1.0</string>
</dict></plist>
PLIST

ln -sf Versions/A/Resources "$FW_DIR/Resources"

echo "✅ Framework built: $FW_DIR"
ls -lh "$FW_DIR/"

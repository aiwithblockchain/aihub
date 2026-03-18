#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
OUT_DIR="$ROOT_DIR/lib"
FW_NAME="LocalBridge"
FW_DIR="$OUT_DIR/$FW_NAME.framework"
APPLE_PROJECT_FRAMEWORKS_DIR="$ROOT_DIR/../apple/LocalBridgeApple/Frameworks"
APPLE_PROJECT_FW_DIR="$APPLE_PROJECT_FRAMEWORKS_DIR/$FW_NAME.framework"
MACOS_DEPLOYMENT_TARGET="${MACOS_DEPLOYMENT_TARGET:-13.5}"
ARM64_ARCHIVE="$OUT_DIR/${FW_NAME}-arm64.a"
X86_64_ARCHIVE="$OUT_DIR/${FW_NAME}-x86_64.a"
UNIVERSAL_ARCHIVE="$OUT_DIR/${FW_NAME}.a"

echo "🔨 Building Go c-archive..."
mkdir -p "$OUT_DIR"

cd "$ROOT_DIR"

echo "🎯 macOS deployment target: $MACOS_DEPLOYMENT_TARGET"

build_archive() {
  local arch="$1"
  local output="$2"

  echo "🏗️  Building $arch archive..."
  CGO_ENABLED=1 GOOS=darwin GOARCH="$arch" \
    MACOSX_DEPLOYMENT_TARGET="$MACOS_DEPLOYMENT_TARGET" \
    CGO_CFLAGS="-mmacosx-version-min=$MACOS_DEPLOYMENT_TARGET" \
    CGO_LDFLAGS="-mmacosx-version-min=$MACOS_DEPLOYMENT_TARGET" \
    go build -buildmode=c-archive \
    -o "$output" \
    ./cmd/localbridge
}

# 生成两套静态库，再合并成通用 archive。
build_archive arm64 "$ARM64_ARCHIVE"
build_archive x86_64 "$X86_64_ARCHIVE"

echo "🧩 Creating universal archive..."
lipo -create -output "$UNIVERSAL_ARCHIVE" "$ARM64_ARCHIVE" "$X86_64_ARCHIVE"

echo "📦 Assembling macOS Framework..."
rm -rf "$FW_DIR"
mkdir -p "$FW_DIR/Versions/A/Headers"

# 复制静态库和头文件
cp "$UNIVERSAL_ARCHIVE" "$FW_DIR/Versions/A/${FW_NAME}"
cp "$OUT_DIR/${FW_NAME}.h" "$FW_DIR/Versions/A/Headers/${FW_NAME}.h"

# 创建 Framework 符号链接（标准结构要求）
ln -sf Versions/A/Headers "$FW_DIR/Headers"
ln -sf Versions/A/${FW_NAME} "$FW_DIR/${FW_NAME}"
ln -sf A "$FW_DIR/Versions/Current"

# 写入 module.modulemap，供 Swift 直接 import LocalBridge
mkdir -p "$FW_DIR/Versions/A/Modules"
cat > "$FW_DIR/Versions/A/Modules/module.modulemap" << 'MODULEMAP'
framework module LocalBridge {
  umbrella header "LocalBridge.h"
  export *
  module * { export * }
}
MODULEMAP
ln -sf Versions/A/Modules "$FW_DIR/Modules"

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
lipo -info "$FW_DIR/Versions/A/${FW_NAME}"

echo "📁 Syncing framework into apple project..."
mkdir -p "$APPLE_PROJECT_FRAMEWORKS_DIR"
rm -rf "$APPLE_PROJECT_FW_DIR"
cp -R "$FW_DIR" "$APPLE_PROJECT_FW_DIR"

echo "✅ Synced framework: $APPLE_PROJECT_FW_DIR"

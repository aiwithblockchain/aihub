#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_PATH="${PROJECT_PATH:-$ROOT_DIR/LocalBridgeApple.xcodeproj}"
SCHEME="${SCHEME:-LocalBridgeMac}"
CONFIGURATION="${CONFIGURATION:-Release}"
BUILD_DIR="${BUILD_DIR:-$ROOT_DIR/build}"
OUT_DIR="${OUT_DIR:-$ROOT_DIR/dist}"
DERIVED_DATA_PATH="${DERIVED_DATA_PATH:-$ROOT_DIR/.derived_data}"

APP_BUNDLE_NAME="${APP_BUNDLE_NAME:-OpeHub}"
APP_PATH="${APP_PATH:-$BUILD_DIR/$CONFIGURATION/$APP_BUNDLE_NAME.app}"

DEV_ID_APP="${DEV_ID_APP:-Developer ID Application: Yushian (Beijing) Technology Co., Ltd. (2XYK8RBB6M)}"
NOTARY_PROFILE="${NOTARY_PROFILE:-notary-profile}"

DMG_NAME="${DMG_NAME:-OpeHub}"
VOL_NAME="${VOL_NAME:-$DMG_NAME}"
SIGN_DMG="${SIGN_DMG:-1}"
NOTARIZE_DMG="${NOTARIZE_DMG:-1}"
CLEAN_BUILD="${CLEAN_BUILD:-1}"

err() { echo "ERROR: $*" >&2; exit 1; }
info() { echo "==> $*"; }

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || err "missing required command: $1"
}

is_macho() {
  local path="$1"
  [[ -f "$path" ]] || return 1
  file -b "$path" | grep -Eiq 'Mach-O'
}

sign_one() {
  local path="$1"
  chmod 755 "$path" 2>/dev/null || true
  xattr -rc "$path" || true
  codesign --remove-signature "$path" >/dev/null 2>&1 || true
  codesign --force --options runtime --timestamp --sign "$DEV_ID_APP" "$path"
}

build_app() {
  local -a actions=(build)
  if [[ "$CLEAN_BUILD" == "1" ]]; then
    actions=(clean build)
  fi

  info "Build $SCHEME ($CONFIGURATION)"
  if [[ "$CLEAN_BUILD" == "1" ]]; then
    rm -rf "$DERIVED_DATA_PATH"
  fi
  mkdir -p "$BUILD_DIR" "$OUT_DIR"

  xcodebuild \
    -project "$PROJECT_PATH" \
    -scheme "$SCHEME" \
    -configuration "$CONFIGURATION" \
    -derivedDataPath "$DERIVED_DATA_PATH" \
    -destination "platform=macOS" \
    SYMROOT="$BUILD_DIR" \
    "${actions[@]}"
}

require_cmd xcodebuild
require_cmd codesign
require_cmd xcrun
require_cmd hdiutil
require_cmd spctl
require_cmd file
require_cmd find

[[ -d "$PROJECT_PATH" ]] || err "project not found: $PROJECT_PATH"

info "Project: $PROJECT_PATH"
info "Scheme: $SCHEME"
info "Build dir: $BUILD_DIR"
info "Output dir: $OUT_DIR"
info "Signer: $DEV_ID_APP"
info "Notary profile: $NOTARY_PROFILE"
info "Notarize DMG: $NOTARIZE_DMG"

build_app

[[ -d "$APP_PATH" ]] || err "built app not found: $APP_PATH"

APP_ABS="$(cd "$(dirname "$APP_PATH")" && pwd)/$(basename "$APP_PATH")"
APP_NAME="$(basename "$APP_ABS" .app)"
WORK_DIR="$(mktemp -d -t "${APP_NAME}-work")"
ZIP_PATH="$WORK_DIR/$APP_NAME.zip"
DMG_PATH="$OUT_DIR/$DMG_NAME.dmg"
NOTARY_LOG_APP="$OUT_DIR/$APP_NAME.app.notary.log"
NOTARY_LOG_DMG="$OUT_DIR/$DMG_NAME.dmg.notary.log"

cleanup() {
  rm -rf "$WORK_DIR"
}
trap cleanup EXIT

info "App: $APP_ABS"
info "DMG: $DMG_PATH"

info "Re-sign nested Mach-O files"
CANDIDATES=()
while IFS= read -r -d '' path; do
  CANDIDATES+=("$path")
done < <(find "$APP_ABS/Contents" \( \
  -path "*/Frameworks/*" -o \
  -path "*/MacOS/*" -o \
  -path "*/PlugIns/*" -o \
  -path "*/XPCServices/*" -o \
  -path "*/Helpers/*" -o \
  -path "*/Resources/*" \
  \) -type f -print0 2>/dev/null)

NEED_SIGN=()
for path in "${CANDIDATES[@]}"; do
  if is_macho "$path"; then
    NEED_SIGN+=("$path")
  fi
done

if ((${#NEED_SIGN[@]} > 0)); then
  info "Found ${#NEED_SIGN[@]} nested Mach-O files"
  for pass in 1 2; do
    for path in "${NEED_SIGN[@]}"; do
      sign_one "$path"
    done
  done
fi

info "Re-sign app bundle"
xattr -rc "$APP_ABS" || true
codesign --remove-signature "$APP_ABS" >/dev/null 2>&1 || true
codesign --force --deep --options runtime --timestamp --sign "$DEV_ID_APP" "$APP_ABS"

info "Verify codesign"
codesign --verify --deep --strict --verbose=2 "$APP_ABS"

info "Zip app for notarization"
/usr/bin/xcrun ditto -c -k --keepParent "$APP_ABS" "$ZIP_PATH"

info "Submit app for notarization"
xcrun notarytool submit "$ZIP_PATH" --keychain-profile "$NOTARY_PROFILE" --wait | tee "$NOTARY_LOG_APP"

info "Staple app ticket"
xcrun stapler staple "$APP_ABS"

info "Create DMG"
STAGE_DIR="$(mktemp -d -t "${APP_NAME}-stage")"
cleanup() {
  rm -rf "$WORK_DIR" "$STAGE_DIR"
}
trap cleanup EXIT

cp -R "$APP_ABS" "$STAGE_DIR/"
ln -s /Applications "$STAGE_DIR/Applications" || true

RW_DMG="$(mktemp -u -t "${APP_NAME}-rw").dmg"
hdiutil create -srcfolder "$STAGE_DIR" -volname "$VOL_NAME" -fs HFS+ -format UDRW -ov "$RW_DMG" >/dev/null
hdiutil convert "$RW_DMG" -format UDZO -o "$DMG_PATH" -ov >/dev/null
rm -f "$RW_DMG"

if [[ "$SIGN_DMG" == "1" ]]; then
  info "Codesign DMG"
  codesign --force --sign "$DEV_ID_APP" --timestamp "$DMG_PATH"
fi

if [[ "$NOTARIZE_DMG" == "1" ]]; then
  info "Submit DMG for notarization"
  xcrun notarytool submit "$DMG_PATH" --keychain-profile "$NOTARY_PROFILE" --wait | tee "$NOTARY_LOG_DMG"
  info "Staple DMG ticket"
  xcrun stapler staple "$DMG_PATH"
fi

info "Gatekeeper check (.app)"
spctl -a -vv "$APP_ABS" || true

info "Gatekeeper check (DMG)"
spctl -a -vv --type open "$DMG_PATH" || true

echo
echo "Done:"
echo "  App: $APP_ABS"
echo "  DMG: $DMG_PATH"
echo "  App notary log: $NOTARY_LOG_APP"
if [[ "$NOTARIZE_DMG" == "1" ]]; then
  echo "  DMG notary log: $NOTARY_LOG_DMG"
fi

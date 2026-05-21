# LocalBridge Windows DLL Build Script
# Purpose: Compile Go LocalBridge as a Windows DLL for Rust FFI

$ErrorActionPreference = "Stop"

$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$ROOT_DIR = Split-Path -Parent $SCRIPT_DIR
$OUT_DIR = "$ROOT_DIR\lib"
$DLL_NAME = "LocalBridgeCore"

Write-Host "==> LocalBridge Windows DLL Build Script" -ForegroundColor Cyan
Write-Host "Root Directory: $ROOT_DIR"
Write-Host "Output Directory: $OUT_DIR"
Write-Host ""

# Create output directory
if (-not (Test-Path $OUT_DIR)) {
    New-Item -ItemType Directory -Path $OUT_DIR | Out-Null
}

Set-Location $ROOT_DIR

# Check Go installation
Write-Host "[1/4] Checking Go installation" -ForegroundColor Cyan
try {
    $null = Get-Command go -ErrorAction Stop
    Write-Host "OK Go is installed and available in PATH" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Go is not installed or not in PATH" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Check CGO support
Write-Host "[2/4] Checking CGO support" -ForegroundColor Cyan
$env:CGO_ENABLED = "1"
Write-Host "OK CGO enabled" -ForegroundColor Green
Write-Host ""

# Build DLL
Write-Host "[3/4] Building Windows DLL" -ForegroundColor Cyan
$env:CGO_ENABLED = "1"
$env:GOOS = "windows"
$env:GOARCH = "amd64"

Write-Host "Building $DLL_NAME.dll..." -ForegroundColor Yellow
go build -buildmode=c-shared -o "$OUT_DIR\$DLL_NAME.dll" .\cmd\rust-bridge

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: DLL build failed" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path "$OUT_DIR\$DLL_NAME.dll")) {
    Write-Host "ERROR: DLL file not generated" -ForegroundColor Red
    exit 1
}

Write-Host "OK DLL built successfully" -ForegroundColor Green
Write-Host ""

# Verify DLL exports
Write-Host "[4/4] Verifying DLL exports" -ForegroundColor Cyan
$dllPath = "$OUT_DIR\$DLL_NAME.dll"
$dllSize = (Get-Item $dllPath).Length
$dllSizeMB = [math]::Round($dllSize / 1MB, 2)

Write-Host "DLL Size: $dllSizeMB MB" -ForegroundColor Yellow

# Check if header file was generated
if (Test-Path "$OUT_DIR\$DLL_NAME.h") {
    Write-Host "OK Header file generated: $DLL_NAME.h" -ForegroundColor Green
} else {
    Write-Host "WARNING: Header file not found" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "==> SUCCESS DLL build completed" -ForegroundColor Green
Write-Host ""
Write-Host "Output files:"
Write-Host "  DLL: $OUT_DIR\$DLL_NAME.dll"
Write-Host "  Header: $OUT_DIR\$DLL_NAME.h"
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. Copy DLL to TweetPilot: src-tauri\src\services\local_bridge\windows\"
Write-Host "  2. Verify exported symbols with: dumpbin /EXPORTS $DLL_NAME.dll"
Write-Host "  3. Continue with Rust FFI integration"

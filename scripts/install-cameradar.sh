#!/usr/bin/env bash
# Install Cameradar v6 pre-built binary (no Go required).
set -euo pipefail

VERSION="v6.1.1"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ARCH="$(uname -m)"

case "$ARCH" in
  arm64)  ASSET="cameradar_darwin_arm64.tar.gz" ;;
  x86_64) ASSET="cameradar_darwin_amd64.tar.gz" ;;
  *) echo "Unsupported arch: $ARCH"; exit 1 ;;
esac

URL="https://github.com/Ullaakut/cameradar/releases/download/${VERSION}/${ASSET}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "Downloading Cameradar ${VERSION} for ${ARCH}…"
curl -fsSL -o "$TMP/cameradar.tar.gz" "$URL"
tar -xzf "$TMP/cameradar.tar.gz" -C "$TMP" cameradar
mkdir -p "$ROOT/bin"
install -m 0755 "$TMP/cameradar" "$ROOT/bin/cameradar"

if ! command -v nmap >/dev/null 2>&1; then
  echo ""
  echo "Note: nmap is required by Cameradar. Install with: brew install nmap"
fi

echo ""
echo "Installed: $ROOT/bin/cameradar"
"$ROOT/bin/cameradar" --version
echo ""
echo "Add this to .env.local:"
echo "CAMERADAR_BIN=$ROOT/bin/cameradar"

#!/usr/bin/env bash
set -euo pipefail

# Package the Chrome extension into a clean ZIP for Web Store upload.
# Usage: ./scripts/package-extension.sh

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v zip >/dev/null 2>&1; then
  echo "Error: 'zip' command not found. Please install zip (e.g., 'brew install zip' on macOS)." >&2
  exit 1
fi

if [[ ! -f "manifest.json" ]]; then
  echo "Error: manifest.json not found at repo root: $ROOT_DIR" >&2
  exit 1
fi

# Extract version from manifest.json (simple, robust sed)
VERSION=$(sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' manifest.json | head -n1)
if [[ -z "${VERSION}" ]]; then
  echo "Warning: Could not parse version from manifest.json. Using '0.0.0'." >&2
  VERSION="0.0.0"
fi

# Ensure built background bundle exists
if [[ ! -f "dist/background.js" ]]; then
  echo "dist/background.js not found. Building background bundle..." >&2
  if command -v npm >/dev/null 2>&1; then
    npm run build:bg
  else
    echo "Error: npm not found. Please run 'npm run build:bg' manually before packaging." >&2
    exit 1
  fi
fi

OUT_DIR="release"
mkdir -p "$OUT_DIR"
OUT_ZIP="$OUT_DIR/simple-tab-plus-v${VERSION}.zip"

# Files/folders to include in the ZIP. Adjust as needed if you add new top-level assets.
INCLUDES=(
  manifest.json
  app
  dist
)

# Create a temporary staging directory to avoid pulling in unwanted files
STAGE_DIR="$(mktemp -d -t stp_stage_XXXXXXXX)"
trap 'rm -rf "$STAGE_DIR"' EXIT

for path in "${INCLUDES[@]}"; do
  if [[ -e "$path" ]]; then
    rsync -a --exclude ".DS_Store" --exclude "node_modules" --exclude ".git" "$path" "$STAGE_DIR/"
  else
    echo "Warning: '$path' not found; skipping." >&2
  fi
done

# Zip from the staging directory to ensure only desired content is included
(cd "$STAGE_DIR" && zip -r -q "$OUT_ZIP" .)

# Move ZIP back to OUT_DIR if zip created it inside staging
if [[ -f "$STAGE_DIR/$OUT_ZIP" ]]; then
  mkdir -p "$(dirname "$OUT_ZIP")"
  mv "$STAGE_DIR/$OUT_ZIP" "$OUT_ZIP"
fi

echo "Packaged extension -> $OUT_ZIP"


#!/bin/sh
# Build the source archive for AMO review. It contains all extension source plus BUILD.md,
# so a reviewer can regenerate signalsmith-worklet.js (node gen-worklet.mjs) and the store
# zips (sh pack.sh) and reproduce the submitted add-on. Excludes dist and the local docs.
set -e
cd "$(dirname "$0")"
VERSION=$(node -e 'console.log(require("./manifest.json").version)')
mkdir -p dist
STAGE="dist/src-$VERSION"
rm -rf "$STAGE"; mkdir -p "$STAGE/icons"
cp manifest.json background.js engine.js panel.js panel.css loop.js content.js \
   signalsmith-stretch.mjs gen-worklet.mjs pack.sh BUILD.md "$STAGE/"
cp icons/icon-16.png icons/icon-32.png icons/icon-48.png icons/icon-128.png "$STAGE/icons/"
OUT="dist/etude-looper-source-$VERSION.zip"
rm -f "$OUT"
( cd "$STAGE" && zip -qr "../etude-looper-source-$VERSION.zip" . )
rm -rf "$STAGE"
echo "wrote $OUT"

#!/bin/sh
# Zip the extension for store submission (same zip for AMO and Chrome Web Store).
# Local docs (SPEC/PLAN/TESTING), dev scripts, and dist are not packed.
set -e
cd "$(dirname "$0")"
VERSION=$(node -e 'console.log(require("./manifest.json").version)')
mkdir -p dist
OUT="dist/etude-extension-$VERSION.zip"
rm -f "$OUT"
zip -q "$OUT" manifest.json background.js engine.js panel.js panel.css loop.js content.js \
  signalsmith-stretch.mjs signalsmith-worklet.js icons/icon-16.png icons/icon-32.png \
  icons/icon-48.png icons/icon-128.png
echo "wrote $OUT"
unzip -l "$OUT"

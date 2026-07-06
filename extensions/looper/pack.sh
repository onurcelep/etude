#!/bin/sh
# Build a store zip per browser. The committed manifest.json carries the documented
# cross-browser background (service_worker + scripts) so one unpacked folder loads in
# either browser during development, at the cost of a harmless Chrome warning about the
# ignored scripts key. For the stores we emit a clean, warning-free manifest each:
#   Chrome:  background.service_worker only (drop scripts and the Firefox-only gecko block)
#   Firefox: background.scripts only (keep the gecko block)
set -e
cd "$(dirname "$0")"
VERSION=$(node -e 'console.log(require("./manifest.json").version)')
mkdir -p dist
ASSETS="background.js engine.js panel.js panel.css loop.js content.js signalsmith-stretch.mjs signalsmith-worklet.js"

for BR in chrome firefox; do
  STAGE="dist/stage-$BR"
  rm -rf "$STAGE"; mkdir -p "$STAGE/icons"
  cp $ASSETS "$STAGE/"
  cp icons/icon-16.png icons/icon-32.png icons/icon-48.png icons/icon-128.png "$STAGE/icons/"
  node -e '
    const fs = require("fs");
    const m = JSON.parse(fs.readFileSync("./manifest.json", "utf8"));
    if (process.argv[1] === "chrome") {
      m.background = { service_worker: "background.js" };
      delete m.browser_specific_settings;
    } else {
      m.background = { scripts: ["background.js"] };
    }
    fs.writeFileSync(process.argv[2] + "/manifest.json", JSON.stringify(m, null, 2) + "\n");
  ' "$BR" "$STAGE"
  OUT="dist/etude-looper-$BR-$VERSION.zip"
  rm -f "$OUT"
  ( cd "$STAGE" && zip -qr "../etude-looper-$BR-$VERSION.zip" . )
  rm -rf "$STAGE"
  echo "wrote $OUT"
done

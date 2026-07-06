#!/bin/sh
# Cut an extension release: bump the manifest version, then build the two store zips.
# Usage: ./release.sh [patch|minor|major]   (default: patch)
# It does NOT commit, tag, or upload. It prints the exact next steps so releasing
# stays a deliberate, local-first action.
set -e
cd "$(dirname "$0")"
BUMP="${1:-patch}"
case "$BUMP" in
  patch|minor|major) ;;
  *) echo "usage: ./release.sh [patch|minor|major]"; exit 1 ;;
esac

OLD=$(node -e 'console.log(require("./manifest.json").version)')
# Bump by string replace so the rest of manifest.json keeps its exact formatting.
NEW=$(node -e '
  const fs = require("fs");
  let s = fs.readFileSync("./manifest.json", "utf8");
  const cur = JSON.parse(s).version;
  let [a, b, c] = cur.split(".").map(Number);
  const bump = process.argv[1];
  if (bump === "major") { a++; b = 0; c = 0; }
  else if (bump === "minor") { b++; c = 0; }
  else { c++; }
  const next = a + "." + b + "." + c;
  s = s.replace(`"version": "${cur}"`, `"version": "${next}"`);
  fs.writeFileSync("./manifest.json", s);
  console.log(next);
' "$BUMP")

echo "version: $OLD -> $NEW"
./pack.sh
cat <<EOF

next steps (nothing was committed or uploaded):
  1. verify both browsers from the unpacked folder using extension/TESTING.md
  2. git add extension/manifest.json && git commit -m "[local] Extension v$NEW"
  3. git tag etude-looper-ext-v$NEW      (share later with: git push --tags)
  4. Chrome Web Store  <- dist/etude-looper-chrome-$NEW.zip
     Firefox AMO       <- dist/etude-looper-firefox-$NEW.zip
EOF

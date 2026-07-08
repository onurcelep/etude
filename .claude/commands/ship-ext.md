---
description: Release the Looper extension — bump, build zips, tag, and cut a GitHub Release
argument-hint: "[patch|minor|major] (default patch)"
allowed-tools: Bash, Read
---

Release a new version of the Looper browser extension, following the repo's flow (see CLAUDE.md "Extension release workflow"). Do NOT upload to the stores — that step is manual. Stop after the GitHub Release exists.

Bump type: `$ARGUMENTS` (default `patch` if empty).

1. From `extensions/looper/`, regenerate the worklet and bump + build the store zips:
   `node gen-worklet.mjs && sh release.sh ${ARGUMENTS:-patch}`
   (bumps `manifest.json`, writes `dist/etude-looper-{chrome,firefox}-<version>.zip`).
2. Build the AMO source zip: `sh pack-source.sh`.
3. Read the new version from `manifest.json`; verify all three zips exist and that the chrome zip's `name`/`version` are correct.
4. Commit the bump (`manifest.json` + any regenerated worklet; `dist/` is git-excluded): `Looper ext: release v<version>`.
5. Push `main`, then tag and push: `git tag etude-looper-ext-v<version> && git push origin etude-looper-ext-v<version>` (triggers `etude-looper-ext-release.yml`).
6. Wait for the release workflow; confirm the GitHub Release has the chrome + firefox zips; print the release URL.
7. Remind me to upload the zips to the Chrome Web Store and Firefox AMO (manual) and to paste copy from `STORE-LISTING.md`.

# Looper browser extension — reference

Deep reference for `extensions/looper/`, moved out of CLAUDE.md (which
keeps the rules; this file keeps the detail). Read this before touching
extension internals or running a release.

`extensions/looper/` is a Manifest V3 add-on (Firefox 128+ and Chrome)
that brings the Looper's Signalsmith engine to online video (transpose,
fine pitch, pitch-preserving speed, A-B loops on YouTube). Self-contained
vanilla JS, no build step, same golden rules as the site. Shares design
lineage with the web app, not code.

## Two deploy targets, decoupled

The website deploys on `git push` (Pages). The extension does NOT:
`extensions/looper/` is excluded from the Pages artifact (see
`deploy-pages.yml`), and the stores only ship what you upload. Push
extension code freely; users get nothing until you submit a store build.
Releasing is a separate, deliberate act.

## Cross-browser background

The committed `manifest.json` keeps BOTH `background.service_worker` and
`background.scripts` (the documented pattern: Chrome uses the worker and
ignores `scripts` with a harmless warning; Firefox uses `scripts`). One
unpacked folder loads in either browser for dev. `pack.sh` emits clean
per-browser store zips (Chrome: `service_worker` only, no gecko block;
Firefox: `scripts` only) so published builds are warning-free.

## Release workflow

1. Land extension changes on `main` the normal way (branch, PR, merge).
   Merging does not release the extension.
2. `cd extensions/looper && ./release.sh [patch|minor|major]` bumps
   `manifest.json` and builds
   `dist/etude-looper-{chrome,firefox}-<version>.zip`. Stores reject an
   upload whose version is not higher than the last, so always bump.
3. Verify both browsers from the unpacked folder
   (`extensions/looper/TESTING.md`); `web-ext lint` the Firefox zip for
   AMO.
4. Commit the bump, then `git tag etude-looper-ext-v<version>` and
   `git push --tags`. The tag push triggers
   `etude-looper-ext-release.yml`, which rebuilds the zips and attaches
   them to a GitHub Release (it does not upload to the stores).
5. Download the zips from the release; upload `etude-looper-chrome-*` to
   the Chrome Web Store, `etude-looper-firefox-*` to Firefox AMO. Stores
   review, then auto-update installed users.

`/ship-ext [patch|minor|major]` automates the mechanical part of this
flow (bump, build, tag, GitHub Release); store uploads stay manual.

## Versioning + tags

Extension SemVer lives in `manifest.json`, its own train (unrelated to
the SW cache number or the web). Tag prefixes: `etude-v*` for website
milestones, `etude-looper-ext-v*` for extension releases. No true store
rollback; to undo, publish a higher version (Chrome staged rollout %
helps for risky ones).

## The one coupling

Once published, put the two store URLs into `EXT_STORES` in
`looper/index.html` and push the web, which flips on the Looper's "get
the extension" cross-link (desktop + browser-detected, hidden until the
URLs exist).

## Internals

Four content scripts in one isolated world. `engine.js` (only Web Audio;
live Signalsmith via `createMediaElementSource`; worklet loaded from an
extension URL because YouTube CSP blocks blob worklets), `panel.js` (pure
UI, EN/TR/DE with a live selector defaulting to the page language),
`loop.js` (A-B + per-video storage), `content.js` (orchestrator, SPA-nav,
speed, toolbar toggle via `background.js`; guards `chrome.*` against
post-reload "context invalidated"). Dev scripts: `gen-worklet.mjs`,
`pack.sh`, `pack-source.sh`, `release.sh`. Local-only
`extensions/looper/{SPEC,PLAN,TESTING}.md` and `dist/` are git-excluded.

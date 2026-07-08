# CLAUDE.md - Etude

Guidance for working on this repo. Read by Claude Code locally **and** by the `@claude` GitHub Action (`.github/workflows/claude.yml`), so both inherit the same rules. Keep it accurate and rule-focused.

## What this is

Etude is a small suite of private, offline, browser-based tools for practicing musicians. No accounts, no uploads, no tracking. Everything runs in the browser. Live at https://onurcelep.github.io/etude/ (local dir `~/code/etude`, GitHub remote `etude`).

Currently one tool ships (the Looper). A metronome and a tuner are planned.

## Golden rules

- **No build step. Vanilla HTML/CSS/JS only. No npm, no bundler, no framework, no dependencies.** If a change seems to need tooling, it is the wrong change.
- **Each tool is one self-contained static page.** Tools do not share JS. The only shared asset is design tokens.
- **Pushing to `main` deploys to production.** The GitHub Actions workflow publishes the whole repo to Pages on every push to `main`. There is no staging. Treat a push as a live release.
- **Local-first: preview locally, never `git push` until explicitly told to deploy.** Local, unpushed commits use a `[local]` prefix in the commit subject (see git history). Keep that convention.
- Prose and UI copy: avoid em dashes. Use a period, comma, colon, or `·`.

## For the @claude GitHub Action (the CI agent)

`@claude` in an issue or PR comment runs Claude Code in GitHub Actions (`.github/workflows/claude.yml`); `.github/workflows/claude-code-review.yml` auto-runs `/code-review` on every PR. Models are pinned in the workflows: **Opus** for the PR review, **Sonnet** for interactive `@claude`. When you are that CI agent:

- **Never push to `main`. Open a pull request.** A push to `main` deploys to production (see Golden rules), and only a human should merge. The workflow runs with `contents: read` and PR-based behavior to enforce this; treat it as an absolute rule regardless.
- **Do not add a build step, and do not edit the deploy/release workflows** (`deploy-pages.yml`, `etude-looper-ext-release.yml`). The no-build-step rule is not negotiable.
- **Runtime verification in CI is label-gated.** By default the @claude runner has no browser. A PR labeled `needs-browser-check` triggers `claude-browser-verify.yml`, which gives the agent headless Chrome via the chrome-devtools MCP (`.github/mcp/ci.mcp.json`) to run the structural checks a local session would: layout overflow, console errors, engine init and position advance. That still cannot judge how audio *sounds*; flag audible-quality changes for a human ear.
- Keep changes small and reviewable, and follow every convention below.

## Local vs @claude: who pushes where

Two independent paths; the CI agent setup does **not** change how local work is done.

- **Local (you + this CLI)** — commit, `/code-review`, then push straight to `main` when ready (push = deploy). No PR required. This is the primary path: anything touching the audio engine, Looper layout, or the extension, where a real-browser verify matters.
- **@claude (remote)** — tag it on an issue or PR for small, describable, or async tasks. It runs in CI, cannot push to `main` (`contents: read`), and **opens a PR** you review and merge (merge = deploy).

The auto Opus PR-review only runs on PRs, so direct-to-`main` local commits skip it — running `/code-review` before pushing is their gate. To have the bot review local work, push it to a branch and open a PR instead of pushing to `main`.

## Slash commands (`.claude/commands/`)

Repeatable flows, available locally and (where they don't need a browser) to `@claude`:

- `/ship-ext [patch|minor|major]` — bump, build the store zips, tag, and cut the extension GitHub Release. Uploading to the stores stays manual.
- `/verify-mobile [path]` — serve the site and drive Chrome at phone width to catch mobile layout regressions. Local only (needs a browser + http server).
- `/deploy-check [marker]` — after a push, confirm the live site actually updated, tolerating Pages CDN lag.

## Layout

```
/index.html          the Etude hub (landing page); links shared/theme.css
/looper/index.html   the Looper tool (self-contained: inline CSS + JS)
/looper/sw.js        Looper service worker (offline app shell, scope /looper/)
/looper/manifest.json, icon-192.png, icon-512.png   PWA assets
/looper/signalsmith-stretch.mjs   vendored Signalsmith Stretch (MIT), the audio engine
/shared/theme.css    shared light/dark design tokens
extensions/looper/          the browser add-on (MV3, Firefox + Chrome); NOT served on the website
/.github/workflows/  deploy-pages.yml (site) + etude-looper-ext-release.yml (store zips on tag) + claude.yml, claude-code-review.yml (@claude AI, PR-only)
```

New tools go in their own top-level folder (e.g. `/metronome/`), as a single self-contained page.

## Conventions

- **Theme:** light/dark via `data-theme` on `<html>`, set before paint from `localStorage['etude.theme']` (falling back to `prefers-color-scheme`) to avoid a flash. The hub uses `shared/theme.css`; the Looper currently inlines its own copy of the tokens in its `<style>`. When adding a tool, prefer linking `shared/theme.css` and keep token names consistent (`--paper`, `--ink`, `--accent`, etc.).
- **i18n:** English / Türkçe / Deutsch, auto-detected with a manual toggle. Strings live in an `I18N` object; markup uses `data-i18n="key"`, applied by a `t()` helper. Add all three languages for any new user-facing string.
- **Fonts:** sans UI (`--ui`), mono for numeric/data readouts (`--mono`).
- **Persistence:** `localStorage` for theme and language; **IndexedDB** for saved sessions (a file plus its loops and settings).

## Looper internals (the one non-trivial file)

`looper/index.html` is ~1000 lines: inline `<style>`, then markup, then a single inline `<script>`. Key subsystems:

- **Audio engine:** the decoded file audio is played through Signalsmith Stretch (`signalsmith-stretch.mjs`, a WASM AudioWorklet) via the Web Audio API, so transpose and time-stretch compose. Video, if present, is muted and follows the engine's position; play/pause is driven from the video element's events (the video is the visual clock, the engine is the audio).
- **Transport/loop:** A-B markers (draggable dots), named saved loops, play-from-marker.
- **Controls:** transpose (semitones), pitch (cents), speed, keep-pitch, optional song-BPM readout. Sliders center their **neutral** value so the dots line up across rows: transpose/pitch are symmetric (±12, ±100), and speed is **25-175% linear** (100% at center). Pitch & Speed rows use a CSS grid with fixed columns so value/unit align.

### Signalsmith engine gotchas (hard-won; expect this class of bug)

- Create the node with **`numberOfInputs: 1`**. With `0`, the worklet's `process()` reads `inputList[0].length` and throws `Cannot read properties of undefined` — intermittently (only when the current segment is inactive), showing up as a silent micro-loop.
- **Resume the AudioContext before creating the engine.** The worklet's WASM only inits on a running context; build it while suspended (e.g. right after a pause) and it never starts. The app unlocks/resumes the context on the first user gesture.
- **Pause/resume = suspend/resume the whole AudioContext**, not disconnecting the node — a disconnected worklet keeps advancing, so disconnecting does not pause it.
- **Position:** read from the engine (`inputTime`) while playing; hold a saved value while paused/suspended so a seek still updates the timeline immediately.
- **`decodeAudioData`:** support both the promise and old callback forms (iOS Safari), and match audio files by extension too (`.wav` etc. can report an empty MIME type).
- Append **`?debug`** to the Looper URL for a live readout of AudioContext state, buffer mode, and position.

## Service worker cache

`looper/sw.js` uses a named cache (currently `etude-looper-v9`). Navigation is network-first (updates show when online), static assets are cache-first. **When you change any cached asset, bump the `CACHE` constant** or clients keep serving stale files. The activate step deletes all other caches. The service worker is not registered on `localhost`/`file:` (dev), so local edits always show; it registers only on the deployed origin. On the iPad, reload twice or use a Private tab to get past an old cache.

## Extension (browser add-on)

`extensions/looper/` is a Manifest V3 add-on (Firefox 128+ and Chrome) that brings the Looper's Signalsmith engine to online video (transpose, fine pitch, pitch-preserving speed, A-B loops on YouTube). Self-contained vanilla JS, no build step, same golden rules as the site. Shares design lineage with the web app, not code.

**Two deploy targets, decoupled.** The website deploys on `git push` (Pages). The extension does NOT: `extensions/looper/` is excluded from the Pages artifact (see `deploy-pages.yml`), and the stores only ship what you upload. Push extension code freely; users get nothing until you submit a store build. Releasing is a separate, deliberate act.

**Cross-browser background.** The committed `manifest.json` keeps BOTH `background.service_worker` and `background.scripts` (the documented pattern: Chrome uses the worker and ignores `scripts` with a harmless warning; Firefox uses `scripts`). One unpacked folder loads in either browser for dev. `pack.sh` emits clean per-browser store zips (Chrome: `service_worker` only, no gecko block; Firefox: `scripts` only) so published builds are warning-free.

**Release workflow:**
1. Land changes on `main` (`[local]` commits, push when ready; a push does not release the extension).
2. `cd extensions/looper && ./release.sh [patch|minor|major]` bumps `manifest.json` and builds `dist/etude-looper-{chrome,firefox}-<version>.zip`. Stores reject an upload whose version is not higher than the last, so always bump.
3. Verify both browsers from the unpacked folder (`extensions/looper/TESTING.md`); `web-ext lint` the Firefox zip for AMO.
4. Commit the bump, then `git tag etude-looper-ext-v<version>` and `git push --tags`. The tag push triggers `etude-looper-ext-release.yml`, which rebuilds the zips and attaches them to a GitHub Release (it does not upload to the stores).
5. Download the zips from the release; upload `etude-looper-chrome-*` to the Chrome Web Store, `etude-looper-firefox-*` to Firefox AMO. Stores review, then auto-update installed users.

**Versioning + tags.** Extension SemVer lives in `manifest.json`, its own train (unrelated to the SW cache number or the web). Tag prefixes: `etude-v*` for website milestones, `etude-looper-ext-v*` for extension releases. No true store rollback; to undo, publish a higher version (Chrome staged rollout % helps for risky ones).

**The one coupling:** once published, put the two store URLs into `EXT_STORES` in `looper/index.html` and push the web, which flips on the Looper's "get the extension" cross-link (desktop + browser-detected, hidden until the URLs exist).

**Internals:** four content scripts in one isolated world. `engine.js` (only Web Audio; live Signalsmith via `createMediaElementSource`; worklet loaded from an extension URL because YouTube CSP blocks blob worklets), `panel.js` (pure UI, EN/TR/DE with a live selector defaulting to the page language), `loop.js` (A-B + per-video storage), `content.js` (orchestrator, SPA-nav, speed, toolbar toggle via `background.js`; guards `chrome.*` against post-reload "context invalidated"). Dev scripts: `gen-worklet.mjs`, `pack.sh`, `pack-source.sh`, `release.sh`. Local-only `extensions/looper/{SPEC,PLAN,TESTING}.md` and `dist/` are git-excluded.

## How to work here

- **Run it:** it is a static site. Serve the repo root over http (e.g. `python3 -m http.server`) and open `/` or `/looper/`. Do not open via `file://` (service worker and module imports need http).
- **Verify in a real browser, not just by reading.** The bugs live in audio/DOM runtime behavior. Reproduce first, then fix.
- **Browser automation is available (Chrome DevTools MCP, user-scoped, so it loads in every session here).** Claude can drive Chrome itself: navigate, screenshot the UI, read the console, inspect the DOM and computed styles, check responsive sizes. Use it to close the verify loop yourself instead of asking the user to look. Typical flow: serve over http (`python3 -m http.server`, default port 8000), point the MCP at `http://localhost:8000/looper/` (append `?debug` for the live AudioContext/position readout), then screenshot and iterate. Note the audio engine needs a user gesture to start, so a bare page load stays silent until you drive a click.
- **For the `extension/`:** load it unpacked in the driven Chrome (`chrome://extensions` with Developer mode, or launch Chrome with `--load-extension=./extensions/looper`) to screenshot and check the panel and content-script UI the same way.
- **Review before deploy:** run `/code-review` on the diff, then hold for explicit approval to push (push = live).
- **Deploy is via GitHub Actions** (`.github/workflows/`), not the legacy branch builder (which once got stuck and jammed the queue). A push runs the workflow. If a run shows `Deployment failed, try again later` (a transient GitHub Pages error, not a code problem), just re-run it: `gh workflow run "Deploy to GitHub Pages" --ref main`. After deploy, verify the live file actually changed (`curl` a marker) since the Pages CDN can lag.
- **Scale the tooling to the task.** This is a solo, ~1200-line, single-file-per-tool project. Heavy multi-agent orchestration, worktree parallelism, and spec frameworks are overkill for edits to an existing tool. They only start to pay off when building a genuinely new independent tool (metronome, tuner): a short spec first, then build it in isolation.

## When to use specs, subagents, or workflows

Match the mechanism to the task, not the tool. These pay off with many independent, parallelizable tasks and context too big for one window. Etude is the opposite (solo, ~1200 lines, one self-contained file per tool, fits in context), so most orchestration is overhead. The useful split is read vs write: fanning out subagents to *research/read* is cheap and worthwhile; fanning out to *edit* a single-file tool just collides on the same file.

| Task | Spec? | Workflow? | Subagents? | Why |
|---|---|---|---|---|
| Bugfix / tweak to an existing tool | No | No | No | One file, fits in context. systematic-debugging + browser verify, inline. |
| Build a new tool (metronome, tuner) | Yes, ~1 page | No | Maybe 1 (isolated) | Real unknowns worth pinning first. Independent folder = safe to isolate. |
| A real decision (e.g. which pitch-detection method) | No | Yes (research only) | Yes | Read-only fan-out is the one pattern that pays off at this scale. |
| Before deploy | No | No | Yes, 1 (`/code-review`) | Single review pass on the diff. |

Efficient defaults:

- This CLAUDE.md is the always-on project spec. For a project this size it replaces most of what a spec framework would give you. Do not adopt GSD / Superpowers / Spec Kit here.
- Write a one-page spec only when starting a net-new tool with genuine unknowns (save as `<tool>/SPEC.md` or keep local). Not for edits.
- Use research fan-out (`/deep-research` or a few parallel Explore subagents) only for real algorithm/library decisions. This is the highest-value use of subagents here.
- Use a worktree only if building two new tools literally in parallel. Otherwise skip it.

## Licensing

MIT. The Looper bundles Signalsmith Stretch (also MIT). Keep attribution in `LICENSE`.

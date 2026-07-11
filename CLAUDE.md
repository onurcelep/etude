# CLAUDE.md — Etude

<!-- factory:standard:begin (managed by /factory-update — do not hand-edit) -->
<!-- factory:version 0.5.2 -->
Read by Claude Code locally and by the @claude GitHub Action, so both
inherit the same rules. Standard setup is stamped by ai-factory
(`/factory-update` refreshes this block only; everything under `## Project`
belongs to this repo).

## Standard rules

- **Every change ships via a short-lived branch and a PR; a human merges.
  Nobody pushes `main` directly** (@claude pushes only `claude/` work
  branches and opens PRs). Full discipline: `factory:release-flow` skill.
- **Review before merge:** the auto PR review runs, and `/code-review` for
  anything nontrivial. What a merge to `main` triggers (deploy, a separate
  release train, or nothing) is per-repo, under `## Project`.
- **Model routing: consult the `factory:model-routing` skill** before
  spawning subagents or editing the model pins in
  `.github/workflows/claude*.yml`.
- **Durable learnings live in `docs/memory/`** — read its `MEMORY.md`
  index before nontrivial work; record new non-obvious, reusable project
  facts there in the same PR. Rules: `factory:repo-memory` skill. Never
  personal data or secrets (the repo may be public).
- Scale tooling to the task: prefer the lightest mechanism that works
  (inline edit < subagent < worktree < workflow).
<!-- factory:standard:end -->

## Project

<!-- Everything below is owned by this repo. /factory-update never touches it. -->

### What this is

Etude is a small suite of private, offline, browser-based tools for practicing musicians. No accounts, no uploads, no tracking. Everything runs in the browser. Live at https://onurcelep.github.io/etude/ (local dir `~/code/etude`, GitHub remote `etude`).

Currently one tool ships (the Looper). A metronome and a tuner are planned.

### Golden rules

- **No build step. Vanilla HTML/CSS/JS only. No npm, no bundler, no framework, no dependencies.** If a change seems to need tooling, it is the wrong change.
- **Each tool is one self-contained static page.** Tools do not share JS. The only shared asset is design tokens.
- **Every change ships through a branch and a PR; merging the PR to `main` is the deploy. Never push straight to `main`.** The Pages workflow publishes on merge, but only for served files: it ignores `extensions/**` and `.github/**` (`deploy-pages.yml`). There is no staging, so a merge that touches served files is a live release. Verify locally in a real browser before merging, then `/deploy-check` after.
- **The extension is a separate, deliberate release: a merge never ships it.** Merging extension code only lands it on `main`; users get nothing until you bump `manifest.json` and push an `etude-looper-ext-v*` tag (see the Extension section). Do not conflate "merged" with "released" for the extension.
- Prose and UI copy: avoid em dashes. Use a period, comma, colon, or `·`.

### For the @claude GitHub Action (the CI agent)

`@claude` in an issue or PR comment runs Claude Code in GitHub Actions (`.github/workflows/claude.yml`); `.github/workflows/claude-code-review.yml` auto-runs `/code-review` on every PR. Models are pinned in the workflows: **Opus** for the PR review, **Sonnet** for interactive `@claude`. When you are that CI agent:

- **Do not add a build step, and do not edit the deploy/release workflows** (`deploy-pages.yml`, `etude-looper-ext-release.yml`). The no-build-step rule is not negotiable.
- **Runtime verification in CI is label-gated.** By default the @claude runner has no browser. A PR labeled `needs-browser-check` triggers `claude-browser-verify.yml`, which gives the agent headless Chrome via the chrome-devtools MCP (`.github/mcp/ci.mcp.json`) to run the structural checks a local session would: layout overflow, console errors, engine init and position advance. That still cannot judge how audio *sounds*; flag audible-quality changes for a human ear.
- Keep changes small and reviewable, and follow every convention below.

### How changes ship

One flow for everyone (see `factory:release-flow`): branch off `main`, open a PR, review, then a human merges. Nobody pushes `main` directly.

- **Local (you + this CLI)** — work on a short-lived branch, verify in a real browser (the bugs are audio/DOM runtime; the review bot can't hear audio), push the branch, open a PR. The auto Opus review runs; `/code-review` yourself for anything nontrivial. Merge when green: merging the PR deploys the site.
- **@claude (remote)** — tag it on an issue or PR for small, describable, or async tasks. It runs in CI, pushes a `claude/` branch, and **opens a PR** you review, verify, and merge (never touching `main` itself).
- Merging deploys the **site** only (path-scoped, see Golden rules). It never releases the extension.

### Slash commands (`.claude/commands/`)

Repeatable flows, available locally and (where they don't need a browser) to `@claude`:

- `/ship-ext [patch|minor|major]` — bump, build the store zips, tag, and cut the extension GitHub Release. Uploading to the stores stays manual.
- `/verify-mobile [path]` — serve the site and drive Chrome at phone width to catch mobile layout regressions. Local only (needs a browser + http server).
- `/deploy-check [marker]` — after a merge, confirm the live site actually updated, tolerating Pages CDN lag.

### Layout

```
/index.html          the Etude hub (landing page); links shared/theme.css
/looper/index.html   the Looper tool (self-contained: inline CSS + JS)
/looper/sw.js        Looper service worker (offline app shell, scope /looper/)
/looper/manifest.json, icon-192.png, icon-512.png   PWA assets
/looper/signalsmith-stretch.mjs   vendored Signalsmith Stretch (MIT), the audio engine
/shared/theme.css    shared light/dark design tokens
extensions/looper/          the browser add-on (MV3, Firefox + Chrome); NOT served on the website
/docs/               extension.md (deep extension reference) + memory/ (agent memory: MEMORY.md index + fact files)
/.github/workflows/  deploy-pages.yml (site) + etude-looper-ext-release.yml (store zips on tag) + claude.yml, claude-code-review.yml (@claude AI, PR-only)
```

New tools go in their own top-level folder (e.g. `/metronome/`), as a single self-contained page.

### Conventions

- **Theme:** light/dark via `data-theme` on `<html>`, set before paint from `localStorage['etude.theme']` (falling back to `prefers-color-scheme`) to avoid a flash. The hub uses `shared/theme.css`; the Looper currently inlines its own copy of the tokens in its `<style>`. When adding a tool, prefer linking `shared/theme.css` and keep token names consistent (`--paper`, `--ink`, `--accent`, etc.).
- **i18n:** English / Türkçe / Deutsch, auto-detected with a manual toggle. Strings live in an `I18N` object; markup uses `data-i18n="key"`, applied by a `t()` helper. Add all three languages for any new user-facing string.
- **Fonts:** sans UI (`--ui`), mono for numeric/data readouts (`--mono`).
- **Persistence:** `localStorage` for theme and language; **IndexedDB** for saved sessions (a file plus its loops and settings).

### Looper internals (the one non-trivial file)

`looper/index.html` is ~1000 lines: inline `<style>`, then markup, then a single inline `<script>`. Key subsystems:

- **Audio engine:** the decoded file audio is played through Signalsmith Stretch (`signalsmith-stretch.mjs`, a WASM AudioWorklet) via the Web Audio API, so transpose and time-stretch compose. Video, if present, is muted and follows the engine's position; play/pause is driven from the video element's events (the video is the visual clock, the engine is the audio).
- **Transport/loop:** A-B markers (draggable dots), named saved loops, play-from-marker.
- **Controls:** transpose (semitones), pitch (cents), speed, keep-pitch. Sliders center their **neutral** value so the dots line up across rows: transpose/pitch are symmetric (±12, ±100), and speed is **25-175% linear** (100% at center). Pitch & Speed rows use a CSS grid with fixed columns so value/unit align.

#### Signalsmith engine gotchas (hard-won; expect this class of bug)

- Create the node with **`numberOfInputs: 1`**. With `0`, the worklet's `process()` reads `inputList[0].length` and throws `Cannot read properties of undefined` — intermittently (only when the current segment is inactive), showing up as a silent micro-loop.
- **Resume the AudioContext before creating the engine.** The worklet's WASM only inits on a running context; build it while suspended (e.g. right after a pause) and it never starts. The app unlocks/resumes the context on the first user gesture.
- **Pause/resume = suspend/resume the whole AudioContext**, not disconnecting the node — a disconnected worklet keeps advancing, so disconnecting does not pause it.
- **Position:** read from the engine (`inputTime`) while playing; hold a saved value while paused/suspended so a seek still updates the timeline immediately.
- **`decodeAudioData`:** support both the promise and old callback forms (iOS Safari), and match audio files by extension too (`.wav` etc. can report an empty MIME type).
- Append **`?debug`** to the Looper URL for a live readout of AudioContext state, buffer mode, and position.

### Service worker cache

**When you change any cached Looper asset, bump the `CACHE` constant in `looper/sw.js`** or clients keep serving stale files. Cache strategy and device quirks: `docs/memory/sw-cache.md`.

### Extension (browser add-on)

`extensions/looper/` is a Manifest V3 add-on (Firefox 128+ and Chrome) that brings the Looper's Signalsmith engine to online video. Same golden rules as the site (vanilla JS, no build step). **It ships on its own deliberate release train: merging to `main` never releases it** — users get nothing until a `manifest.json` version bump plus an `etude-looper-ext-v*` tag, followed by a manual store upload. Internals, cross-browser manifest pattern, release procedure, and versioning/tag rules: `docs/extension.md` (`/ship-ext` automates the mechanical release steps).

### How to work here

- **Run it:** it is a static site. Serve the repo root over http (e.g. `python3 -m http.server`) and open `/` or `/looper/`. Do not open via `file://` (service worker and module imports need http).
- **Verify in a real browser, not just by reading.** The bugs live in audio/DOM runtime behavior. Reproduce first, then fix.
- **Browser automation is available (Chrome DevTools MCP, user-scoped, so it loads in every session here).** Claude can drive Chrome itself: navigate, screenshot the UI, read the console, inspect the DOM and computed styles, check responsive sizes. Use it to close the verify loop yourself instead of asking the user to look. Typical flow: serve over http (`python3 -m http.server`, default port 8000), point the MCP at `http://localhost:8000/looper/` (append `?debug` for the live AudioContext/position readout), then screenshot and iterate. Note the audio engine needs a user gesture to start, so a bare page load stays silent until you drive a click.
- **For the `extension/`:** load it unpacked in the driven Chrome (`chrome://extensions` with Developer mode, or launch Chrome with `--load-extension=./extensions/looper`) to screenshot and check the panel and content-script UI the same way.
- **Review before merge:** open a PR (the auto Opus review runs) and run `/code-review` on the diff for anything nontrivial; a human merges. Merging the PR is the deploy.
- **Deploy is via GitHub Actions** (`.github/workflows/`): a merge to `main` runs the workflow. Known failure modes (transient Pages errors, CDN lag, the legacy branch builder): `docs/memory/pages-deploy-gotchas.md`. Verify after merge with `/deploy-check`.
- **Scale the tooling to the task.** This is a solo, ~1200-line, single-file-per-tool project. Heavy multi-agent orchestration, worktree parallelism, and spec frameworks are overkill for edits to an existing tool. They only start to pay off when building a genuinely new independent tool (metronome, tuner): a short spec first, then build it in isolation.

### When to use specs, subagents, or workflows

Match the mechanism to the task, not the tool. These pay off with many independent, parallelizable tasks and context too big for one window. Etude is the opposite (solo, ~1200 lines, one self-contained file per tool, fits in context), so most orchestration is overhead. The useful split is read vs write: fanning out subagents to *research/read* is cheap and worthwhile; fanning out to *edit* a single-file tool just collides on the same file.

| Task | Spec? | Workflow? | Subagents? | Why |
|---|---|---|---|---|
| Bugfix / tweak to an existing tool | No | No | No | One file, fits in context. systematic-debugging + browser verify, inline. |
| Build a new tool (metronome, tuner) | Yes, ~1 page | No | Maybe 1 (isolated) | Real unknowns worth pinning first. Independent folder = safe to isolate. |
| A real decision (e.g. which pitch-detection method) | No | Yes (research only) | Yes | Read-only fan-out is the one pattern that pays off at this scale. |
| Before merge | No | No | Yes, 1 (`/code-review`) | Single review pass on the diff. |

Efficient defaults:

- This CLAUDE.md is the always-on project spec. For a project this size it replaces most of what a spec framework would give you. The superpowers plugin is enabled (standard setup); use its process skills only when starting a net-new tool. Do not adopt spec-kit or heavy orchestration for edits to an existing tool.
- Write a one-page spec only when starting a net-new tool with genuine unknowns (save as `<tool>/SPEC.md` or keep local). Not for edits.
- Use research fan-out (`/deep-research` or a few parallel Explore subagents) only for real algorithm/library decisions. This is the highest-value use of subagents here.
- Use a worktree only if building two new tools literally in parallel. Otherwise skip it.

### Licensing

MIT. The Looper bundles Signalsmith Stretch (also MIT). Keep attribution in `LICENSE`.

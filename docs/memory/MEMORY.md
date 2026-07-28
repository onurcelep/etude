# Project memory — index

One line per fact file in this directory. Agents: read this index before
nontrivial work and open only the entries relevant to your task. Write
rules and conventions: `factory:repo-memory` skill.

<!-- - [short title](fact-file.md) — one-line hook: when this matters -->

- [Looper service worker cache behavior](sw-cache.md) — touching any cached Looper asset: CACHE bump rule, strategy, device quirks
- [Looper inline-script traps](looper-inline-script-traps.md) — editing looper/index.html JS: one-letter globals (`t` = i18n!) shadowing, and why a tick() crash freezes the transport silently
- [GitHub Pages deploy gotchas](pages-deploy-gotchas.md) — deploy run failed or live site looks stale after a merge
- [@claude CI runs failing silently](ci-claude-silent-failures.md) — @claude/review runs green but do nothing, or die instantly: diagnosis order (token first), verification traps, max-turns sizing

---
description: After a push to main, confirm the live site actually updated (Pages CDN can lag)
argument-hint: "[marker] (a string that should appear in the deployed file)"
allowed-tools: Bash
---

Verify a deploy landed on the live site (see CLAUDE.md "Deploy is via GitHub Actions"). The Pages CDN can lag after a successful run, so retry before calling it failed.

Marker to look for: `$ARGUMENTS` (optional).

1. Wait for the latest site deploy to finish:
   `gh run watch $(gh run list --workflow=deploy-pages.yml --limit 1 --json databaseId -q '.[0].databaseId') --exit-status`.
2. Fetch the relevant URL under `https://onurcelep.github.io/etude/` with cache-busting (append `?t=<random>`), and confirm:
   - the site root returns HTTP 200, and
   - if a marker was given, that the marker string is present in the fetched file — retry a few times with a short wait, since the CDN can lag.
3. Report: deploy run status, HTTP code, and whether the marker is live yet. If it is still not live after ~30s, say so (transient CDN lag) rather than assuming failure — re-running the deploy is the fix: `gh workflow run "Deploy to GitHub Pages" --ref main`.

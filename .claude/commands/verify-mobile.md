---
description: Serve the site and drive Chrome at phone width to catch mobile layout regressions
argument-hint: "[path] (default looper/)"
allowed-tools: Bash, mcp__chrome-devtools__new_page, mcp__chrome-devtools__resize_page, mcp__chrome-devtools__evaluate_script, mcp__chrome-devtools__take_screenshot, mcp__chrome-devtools__list_console_messages
---

Check a page for mobile layout problems in a real browser (see CLAUDE.md "How to work here"). Local only — this needs a browser + http server, so it cannot run in the @claude CI runner.

Target path: `$ARGUMENTS` (default `looper/`).

1. Serve the repo root over http on a spare port in the background: `python3 -m http.server 8777`.
2. Open `http://localhost:8777/${ARGUMENTS:-looper/}` in Chrome DevTools MCP and resize to ~390x844 (a phone).
3. Verify: no horizontal overflow (`document.documentElement.scrollWidth <= clientWidth`), no element extends past the viewport right edge, and zero console errors. Screenshot the top and bottom of the page.
4. If the target is the Looper, click to unlock audio and confirm the engine still initializes (it needs a user gesture) with no console errors.
5. Report concisely: overflow yes/no, any console errors, and anything that looks off. Stop the http server when done. Do NOT push anything.

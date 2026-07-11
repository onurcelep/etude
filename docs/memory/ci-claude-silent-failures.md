# @claude CI runs failing silently: diagnosis order

Two hard-won lessons from the 2026-07-11 outage (all @claude and review
runs dying in ~2s while showing green checks).

**1. The action can mask total failure behind a green check.** A run whose
result JSON shows `"is_error": true`, `num_turns: 1`, `total_cost_usd: 0`
did no work at all, whatever the check color says (known upstream
action behavior). Symptoms: an issue answered only by
"I'll analyze this and get back to you", or a green review check with no
review comment. The error text is hidden by default; add
`show_full_output: true` to the workflow (must be merged to main to take
effect) to see the SDK stream.

**2. Diagnosis order for the instant-`is_error`/$0 signature:**
- **OAuth token first.** That was the actual cause: the repo's
  `CLAUDE_CODE_OAUTH_TOKEN` had gone bad. Rotate with `claude setup-token`
  and `gh secret set CLAUDE_CODE_OAUTH_TOKEN -R <repo>`. Note: you cannot
  verify a token locally via `CLAUDE_CODE_OAUTH_TOKEN=... claude -p ...` —
  the CLI silently prefers keychain credentials, so that test passes with
  any garbage value. Verify in CI (cheap @claude "reply pong" issue).
- **Not the action version.** Pinning the action SHA was tried and did not
  help; the same signature reproduced on two CLI versions. Don't start
  there.
- A cross-repo experiment discriminates fast: trigger @claude in another
  repo with the same secret value. Same result → token/account; different
  → repo config.

**Also:** `--max-turns` must leave room for implement-and-PR tasks
(gather + multi-file edit + branch + push + PR ≈ 15-25 turns). The stamped
default of 10 killed a healthy run at the cap (`error_max_turns`); it is
30 now. That failure mode reports honestly, so it's easy to tell apart.

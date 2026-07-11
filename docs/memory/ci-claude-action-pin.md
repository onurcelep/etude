# Claude Code action pinned to the 2.1.206 build

**Status (2026-07-11):** all three `claude*.yml` workflows pin
`anthropics/claude-code-action@536f2c32a39763739000b0e1ac69ca2647d97ce9`
(the build that installs Claude Code 2.1.206) instead of `@v1`.

**Why:** on 2026-07-11 the floating `@v1` tag moved to a build installing
Claude Code 2.1.207, and every run in this repo started failing instantly:
`"is_error": true`, `num_turns: 1`, `total_cost_usd: 0`, ~2s duration — while
the job still shows a green check (upstream:
anthropics/claude-code-action#1495). The same CLI version works locally, so
the breakage is specific to the action's headless CI path. Last good run used
the 2.1.206 build; first bad run used 2.1.207. Not a token, model-pin, or
plugin problem (all verified).

**How to recognize a recurrence:** an @claude issue comment answered only by
"I'll analyze this and get back to you", or a PR review check that is green
but posted no review. Check the run log for the `"type": "result"` JSON: the
instant-`is_error`/$0 signature means the model call died before doing work.
Compare the resolved action SHA (`Download action repository` line in Set up
job) and the `Installing Claude Code vX.Y.Z...` line against the last good
run.

**To unpin:** once upstream ships a build newer than 2.1.207 that is
confirmed fixed, restore `@v1` in `claude.yml`, `claude-code-review.yml`, and
`claude-browser-verify.yml` (and drop the pin comment blocks). Verify by
re-triggering @claude on any issue and checking the result JSON shows real
turns and nonzero cost.

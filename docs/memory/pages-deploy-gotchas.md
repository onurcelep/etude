# GitHub Pages deploy gotchas

Learned: 2026-07-10 (re-verify before acting if the area has changed)

Deploys run via GitHub Actions, NOT the legacy branch builder — it once
got stuck and jammed the deploy queue; do not re-enable it. A run
failing with "Deployment failed, try again later" is a transient GitHub
Pages error, not a code problem: re-run it with
`gh workflow run "Deploy to GitHub Pages" --ref main`. After merging,
verify the live file actually changed (`curl` a marker, or
`/deploy-check`) — the Pages CDN can lag behind a green deploy run.

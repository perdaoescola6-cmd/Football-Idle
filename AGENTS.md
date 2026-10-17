# Football Card Manager

Canonical repository: perdaoescola6-cmd/Football-Idle. Read README.md and docs/18-github-agent-workflow.md before changing code. Existing game context is in docs/WORK-PROJECT.md and docs/14–17.

Work on one actionable issue at a time, on a fresh branch from origin/main in an isolated checkout/worktree. Never discard unrelated local work. Search existing PRs before starting; do not duplicate work awaiting review. Read nested AGENTS.md instructions.

Preserve saves, player ownership, Coins ledger, idempotency and transaction semantics. Treat catalog sources as historical; do not invent current affiliations. Keep packs at five cards and published odds consistent with server behavior.

Run npm ci, npm run lint, npm run typecheck, npm test and npm run build:check. Add meaningful regression coverage for behavior changes. Report failures and environment limits honestly. Do not claim browser QA unless performed.

Never commit secrets, .env files, .data, caches or node_modules. Never force push, delete existing branches/code, merge automatically or deploy production. Push only the issue branch and open a PR for human review with acceptance criteria, validation and Closes #N. A blocked task needs a concrete report, not an invented success.

In the synced ChatGPT project mirror, sources/ remains read-only. Do not edit synced files or copy local databases into this repository. No autonomous changes outside the selected issue's scope.

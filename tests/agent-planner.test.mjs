import { test } from "node:test";
import assert from "node:assert/strict";
import { planRun, policy } from "../scripts/agent-plan.mjs";
import { recordRun, renderProgress } from "../scripts/agent-progress.mjs";

const issue = (number, area = "rankings", extra = {}) => ({
  number,
  title: `P2: Task ${number}`,
  body: "",
  state: "open",
  user: { login: "perdaoescola6-cmd" },
  labels: ["agent:ready", `area:${area}`],
  ...extra,
});
const pr = (number, task, extra = {}) => ({
  number,
  body: `Closes #${task}`,
  state: "open",
  user: { login: "perdaoescola6-cmd" },
  head: { ref: `codex/${task}-work`, repo: { full_name: policy.repository } },
  checks: "success",
  ...extra,
});
const progress = () => ({
  schemaVersion: 1,
  repository: policy.repository,
  runs: [],
  claims: [],
});
const snapshot = (issues, pullRequests = []) => ({
  repository: policy.repository,
  complete: true,
  issues,
  pullRequests,
  progress: progress(),
});

test("planner selects prioritized independent backlog while an unrelated PR awaits review", () => {
  const s = snapshot(
    [
      issue(4, "competition", { title: "P1: Season" }),
      issue(6, "collection"),
      issue(5),
      issue(13, "visual"),
    ],
    [pr(12, 4)],
  );
  assert.equal(planRun(s).issueNumber, 5);
  assert.equal(planRun(s).branch, "codex/5-rankings");
  s.issues.push(issue(20, "packs", { title: "P1: Fix packs" }));
  assert.equal(planRun(s).issueNumber, 20);
});
test("planner respects the cap and repairs failed CI before adding work", () => {
  const s = snapshot([issue(5)], [pr(12, 4), pr(15, 6), pr(16, 7)]);
  assert.equal(planRun(s).action, "wait");
  s.pullRequests[1].checks = "failure";
  assert.equal(planRun(s).action, "repair");
  s.pullRequests = [
    pr(14, 0, {
      head: {
        ref: "codex/autonomy-setup",
        repo: { full_name: policy.repository },
      },
    }),
  ];
  assert.equal(planRun(s).issueNumber, 5);
});
test("untrusted or blocked issues and unknown/open dependencies are never selected", () => {
  const s = snapshot([
    issue(1, "packs", { user: { login: "outsider" } }),
    issue(2, "catalog", { labels: ["agent:ready", "agent:blocked"] }),
    issue(3, "rankings", { body: "Depends on: #99" }),
  ]);
  assert.equal(planRun(s).action, "wait");
  s.issues.push(issue(99, "maintenance", { state: "closed" }));
  assert.equal(planRun(s).issueNumber, 3);
});
test("planner resumes durable claims and refuses incomplete snapshots", () => {
  const s = snapshot([issue(5), issue(6)]);
  s.progress.claims.push({
    issueNumber: 6,
    status: "running",
    branch: "codex/6-collection",
    attempts: 1,
  });
  assert.equal(planRun(s).action, "resume");
  assert.equal(planRun(s).issueNumber, 6);
  assert.throws(() => planRun({ ...s, complete: false }));
  assert.throws(() => planRun({ ...s, progress: undefined }));
});
test("progress updates are idempotent, preserve runs and render a resumable file", () => {
  const r = {
    runId: "test-run",
    status: "running",
    branch: "codex/5-rankings",
    issueNumber: 5,
    updatedAt: "2026-10-18T00:00:00Z",
    summary: "Selected backlog",
    checks: [],
  };
  const first = recordRun(progress(), r);
  const second = recordRun(first, {
    ...r,
    status: "awaiting_review",
    pullRequest: 15,
  });
  assert.equal(second.runs.length, 1);
  assert.equal(second.claims[0].attempts, 1);
  assert.match(renderProgress(second), /#15/);
  assert.equal(first.runs[0].status, "running");
});
test("closed PRs must be reconciled and repair attempts are bounded", () => {
  const s = snapshot([issue(5), issue(6)], [pr(15, 5, { checks: "failure" })]);
  s.progress.claims.push({
    issueNumber: 5,
    status: "failed",
    pullRequest: 15,
    branch: "codex/5-rankings",
    attempts: 3,
  });
  assert.equal(planRun(s).issueNumber, 6);
  s.progress.claims[0].status = "awaiting_review";
  s.pullRequests = [];
  assert.equal(planRun(s).action, "reconcile");
  s.progress.claims[0].status = "merged";
  s.progress.claims[0].attempts = 1;
  assert.equal(planRun(s).branch, "codex/5-rankings-2");
});

test("progress refuses credentials and unsafe branches; policy cannot silently enable merging", () => {
  const r = {
    runId: "test",
    status: "running",
    branch: "main",
    issueNumber: 5,
    updatedAt: "2026-10-18T00:00:00Z",
    summary: "test",
    checks: [],
  };
  assert.throws(() => recordRun(progress(), r));
  assert.throws(() =>
    recordRun(progress(), {
      ...r,
      branch: "codex/5-rankings",
      summary: "ghp_" + "a".repeat(30),
    }),
  );
  assert.throws(() =>
    planRun(snapshot([issue(5)]), { ...policy, automaticMerge: true }),
  );
});

import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const policy = JSON.parse(
  readFileSync(new URL("../.automation/policy.json", import.meta.url), "utf8"),
);
export function validatePolicy(p) {
  if (
    p.schemaVersion !== 1 ||
    p.repository !== "perdaoescola6-cmd/Football-Idle" ||
    !p.trustedAuthors?.length ||
    !Number.isInteger(p.maxOpenPullRequests) ||
    p.maxOpenPullRequests < 1 ||
    p.maxOpenPullRequests > 3 ||
    p.stateBranch !== "automation/state" ||
    p.automaticMerge !== false ||
    p.productionDeploy !== false ||
    p.forcePush !== false
  )
    throw new Error("Invalid autonomous-development policy");
}
const labels = (item) =>
  (item.labels ?? []).map((l) => (typeof l === "string" ? l : l.name));
const number = (n) => Number.isSafeInteger(n) && n > 0;
export function planRun(snapshot, p = policy) {
  validatePolicy(p);
  if (
    snapshot.repository !== p.repository ||
    snapshot.complete !== true ||
    !Array.isArray(snapshot.issues) ||
    !Array.isArray(snapshot.pullRequests) ||
    snapshot.progress?.schemaVersion !== 1 ||
    !Array.isArray(snapshot.progress.claims)
  )
    throw new Error(
      "Complete GitHub snapshot and durable progress are required; refusing to guess",
    );
  const trusted = (item) => p.trustedAuthors.includes(item.user?.login);
  const unreconciled = snapshot.progress.claims.find(
    (claim) =>
      claim.status === "awaiting_review" &&
      number(claim.pullRequest) &&
      !snapshot.pullRequests.some((pr) => pr.number === claim.pullRequest),
  );
  if (unreconciled)
    return {
      action: "reconcile",
      pullRequest: unreconciled.pullRequest,
      issueNumber: unreconciled.issueNumber,
      reason:
        "Recorded PR is no longer open; verify merged/closed status before resuming.",
    };
  const prs = snapshot.pullRequests.filter(
    (pr) =>
      pr.state === "open" &&
      trusted(pr) &&
      pr.head?.repo?.full_name === p.repository &&
      pr.head.ref.startsWith("codex/") &&
      !p.infrastructureBranches.includes(pr.head.ref),
  );
  const failed = prs
    .filter(
      (pr) =>
        pr.checks === "failure" &&
        !snapshot.progress.claims.some(
          (claim) =>
            claim.pullRequest === pr.number &&
            (claim.attempts ?? 0) >= p.maxRepairAttempts,
        ),
    )
    .sort((a, b) => a.number - b.number)[0];
  if (failed)
    return {
      action: "repair",
      pullRequest: failed.number,
      branch: failed.head.ref,
      reason: "Existing PR has failed checks; fix before adding work.",
    };
  if (prs.length >= p.maxOpenPullRequests)
    return {
      action: "wait",
      reason: "Open PR limit reached; human review is required.",
      openPullRequests: prs.map((pr) => pr.number),
    };
  const covered = new Set();
  for (const pr of prs) {
    const branch = /^codex\/(\d+)-/.exec(pr.head.ref);
    if (branch) covered.add(Number(branch[1]));
    for (const match of (pr.body ?? "").matchAll(
      /\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+#(\d+)\b/gi,
    ))
      covered.add(Number(match[1]));
  }
  const eligible = snapshot.issues.filter(
    (i) =>
      number(i.number) &&
      i.state === "open" &&
      !i.pull_request &&
      trusted(i) &&
      labels(i).includes(p.readyLabel) &&
      !labels(i).some((l) => p.blockedLabels.includes(l)) &&
      !covered.has(i.number),
  );
  const ready = eligible.filter((i) => {
    const line = /^Depends on:\s*([^\n]+)$/im.exec(i.body ?? "");
    if (!line) return true;
    const refs = [...line[1].matchAll(/#(\d+)/g)].map((m) => Number(m[1]));
    return (
      refs.length > 0 &&
      refs.every((n) =>
        snapshot.issues.some(
          (dep) => dep.number === n && dep.state === "closed",
        ),
      )
    );
  });
  const resumable = [...ready]
    .sort((a, b) => a.number - b.number)
    .find((i) =>
      snapshot.progress.claims.some(
        (claim) =>
          claim.issueNumber === i.number &&
          ["running", "failed"].includes(claim.status) &&
          (claim.attempts ?? 1) < p.maxRepairAttempts,
      ),
    );
  const topic = (i) =>
    p.topicOrder.find((area) => labels(i).includes(`area:${area}`)) ??
    "maintenance";
  const priority = (i) =>
    labels(i).includes("priority:P1") || /^P1\b/.test(i.title) ? 1 : 2;
  ready.sort(
    (a, b) =>
      priority(a) - priority(b) ||
      (p.topicOrder.indexOf(topic(a)) < 0
        ? 99
        : p.topicOrder.indexOf(topic(a))) -
        (p.topicOrder.indexOf(topic(b)) < 0
          ? 99
          : p.topicOrder.indexOf(topic(b))) ||
      a.number - b.number,
  );
  const selected =
    resumable ??
    ready.find(
      (i) =>
        !snapshot.progress.claims.some(
          (claim) =>
            claim.issueNumber === i.number &&
            (claim.status === "blocked" ||
              (["running", "failed"].includes(claim.status) &&
                (claim.attempts ?? 1) >= p.maxRepairAttempts)),
        ),
    );
  if (!selected)
    return {
      action: "wait",
      reason: "No approved independent issue is ready.",
      coveredIssues: [...covered].sort((a, b) => a - b),
    };
  const claim = snapshot.progress.claims.find(
    (c) => c.issueNumber === selected.number,
  );
  return {
    action: resumable ? "resume" : "implement",
    issueNumber: selected.number,
    title: selected.title,
    area: topic(selected),
    branch: claim?.branch ?? `codex/${selected.number}-${topic(selected)}`,
    openPullRequests: prs.map((pr) => pr.number),
    validationCommands: p.validationCommands,
    reason:
      "Approved backlog, priority and topic order; no dependency or open PR duplicates.",
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  validatePolicy(policy);
  const index = process.argv.indexOf("--snapshot");
  if (index >= 0)
    console.log(
      JSON.stringify(
        planRun(JSON.parse(readFileSync(process.argv[index + 1], "utf8"))),
        null,
        2,
      ),
    );
  else if (process.argv.includes("--validate"))
    console.log(
      "Autonomous policy valid; automatic merge, production deploy and force push disabled.",
    );
  else throw new Error("Use --validate or --snapshot FILE");
}

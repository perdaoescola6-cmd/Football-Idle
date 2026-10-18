import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { policy } from "./agent-plan.mjs";

// The repository is public. Read-only collection needs no token or stored secret.
const base = `https://api.github.com/repos/${policy.repository}`;
async function get(path) {
  const response = await fetch(base + path, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "Football-Idle-backlog-planner",
    },
  });
  if (!response.ok)
    throw new Error(
      `GitHub snapshot request failed (${response.status}); do not select from an incomplete snapshot.`,
    );
  return response.json();
}
async function pages(path) {
  const result = [];
  for (let page = 1; page <= 20; page++) {
    const batch = await get(
      `${path}${path.includes("?") ? "&" : "?"}per_page=100&page=${page}`,
    );
    result.push(...batch);
    if (batch.length < 100) return result;
  }
  throw new Error(
    "Snapshot pagination limit exceeded; refusing partial backlog",
  );
}
const progress = JSON.parse(
  readFileSync(".automation/local/progress.json", "utf8"),
);
const issues = (await pages("/issues?state=all")).filter(
  (i) => !i.pull_request,
);
const pullRequests = await pages("/pulls?state=open");
for (const pr of pullRequests.filter(
  (p) =>
    policy.trustedAuthors.includes(p.user?.login) &&
    p.head.repo?.full_name === policy.repository &&
    p.head.ref.startsWith("codex/"),
)) {
  const data = await get(`/commits/${pr.head.sha}/check-runs?per_page=100`);
  const required = [
    ...new Map(
      data.check_runs
        .filter((c) => policy.requiredChecks.includes(c.name))
        .sort((a, b) => b.id - a.id)
        .map((c) => [c.name, c])
        .reverse(),
    ).values(),
  ];
  pr.checks = required.some(
    (c) =>
      c.status === "completed" &&
      !["success", "skipped", "neutral"].includes(c.conclusion),
  )
    ? "failure"
    : policy.requiredChecks.every((name) =>
          required.some(
            (c) =>
              c.name === name &&
              c.status === "completed" &&
              c.conclusion === "success",
          ),
        )
      ? "success"
      : "pending";
}
mkdirSync(".automation/local", { recursive: true });
writeFileSync(
  ".automation/local/snapshot.json",
  `${JSON.stringify({ repository: policy.repository, complete: true, capturedAt: new Date().toISOString(), issues, pullRequests, progress }, null, 2)}\n`,
);
console.log(
  JSON.stringify({
    issues: issues.length,
    openPullRequests: pullRequests.length,
    output: ".automation/local/snapshot.json",
  }),
);

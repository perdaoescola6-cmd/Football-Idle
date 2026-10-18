import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { policy } from "./agent-plan.mjs";

export function recordRun(progress, record) {
  if (
    progress.schemaVersion !== 1 ||
    progress.repository !== policy.repository ||
    !Array.isArray(progress.runs) ||
    !Array.isArray(progress.claims) ||
    !/^[a-zA-Z0-9_-]{1,80}$/.test(record.runId) ||
    !["running", "awaiting_review", "failed", "blocked", "merged"].includes(
      record.status,
    ) ||
    !/^codex\/[a-zA-Z0-9._/-]+$/.test(record.branch) ||
    (record.issueNumber !== null &&
      (!Number.isSafeInteger(record.issueNumber) || record.issueNumber < 1)) ||
    typeof record.summary !== "string" ||
    record.summary.length > 1500 ||
    !Number.isFinite(Date.parse(record.updatedAt)) ||
    !Array.isArray(record.checks)
  )
    throw new Error("Invalid progress record");
  if (
    /(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{25,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/.test(
      JSON.stringify(record),
    )
  )
    throw new Error(
      "Possible credential in progress record; refusing to persist",
    );
  const next = structuredClone(progress);
  const existing = next.runs.findIndex((r) => r.runId === record.runId);
  if (existing >= 0) next.runs[existing] = record;
  else next.runs.push(record);
  next.runs = next.runs.slice(-100);
  next.lastUpdated = record.updatedAt;
  if (record.issueNumber !== null) {
    const claim = next.claims.find((c) => c.issueNumber === record.issueNumber);
    const attempts =
      claim?.runId === record.runId
        ? claim.attempts
        : (claim?.attempts ?? 0) + 1;
    const update = {
      issueNumber: record.issueNumber,
      branch: record.branch,
      pullRequest: record.pullRequest ?? null,
      runId: record.runId,
      status: record.status,
      attempts,
      updatedAt: record.updatedAt,
    };
    if (claim) Object.assign(claim, update);
    else next.claims.push(update);
  }
  return next;
}
export function renderProgress(progress) {
  const rows = [...progress.runs]
    .reverse()
    .map(
      (r) =>
        `| ${r.updatedAt} | ${r.issueNumber === null ? "Infraestrutura" : `#${r.issueNumber}`} | ${r.status} | ${r.pullRequest ? `[#${r.pullRequest}](https://github.com/${policy.repository}/pull/${r.pullRequest})` : "—"} | ${r.summary.replace(/[\r\n|]/g, " ")} |`,
    );
  return `# Progresso do desenvolvimento autônomo\n\nRegistro canônico na branch automation/state. Última atualização: ${progress.lastUpdated ?? "inicialização"}.\n\n| Atualização UTC | Tarefa | Estado | PR | Resultado |\n| --- | --- | --- | --- | --- |\n${rows.join("\n")}\n\nO registro detalhado de cada execução está em .automation/runs/. Nenhum merge ou deploy automático está autorizado.\n`;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const branch = execFileSync("git", ["branch", "--show-current"], {
    encoding: "utf8",
  }).trim();
  if (branch !== policy.stateBranch)
    throw new Error("Progress writes are restricted to automation/state");
  const record = JSON.parse(readFileSync(process.argv[2], "utf8"));
  const next = recordRun(
    JSON.parse(readFileSync(".automation/progress.json", "utf8")),
    record,
  );
  mkdirSync(".automation/runs", { recursive: true });
  writeFileSync(
    `.automation/runs/${record.runId}.json`,
    `${JSON.stringify(record, null, 2)}\n`,
  );
  writeFileSync(
    ".automation/progress.json",
    `${JSON.stringify(next, null, 2)}\n`,
  );
  writeFileSync("AUTONOMOUS_PROGRESS.md", renderProgress(next));
  console.log(
    JSON.stringify({ recorded: record.runId, status: record.status }),
  );
}

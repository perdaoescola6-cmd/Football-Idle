import { readFileSync, writeFileSync } from "node:fs";
import { auditCatalog } from "../packages/game/catalog-audit.ts";

const report = auditCatalog();
const json = `${JSON.stringify(report, null, 2)}\n`;
const reportUrl = new URL("../docs/20-catalog-audit.json", import.meta.url);
if (process.argv.includes("--write-report")) writeFileSync(reportUrl, json);
let stale = false;
if (process.argv.includes("--check-report")) {
  try {
    stale = readFileSync(reportUrl, "utf8").replace(/\r\n/g, "\n") !== json;
  } catch {
    stale = true;
  }
  if (stale)
    console.error(
      "Catalog report is stale/missing. Run npm run audit:catalog -- --write-report and review the changes.",
    );
}
process.stdout.write(json);
process.exitCode = report.errors.length || stale ? 1 : 0;

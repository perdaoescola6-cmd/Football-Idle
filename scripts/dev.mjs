import { spawn } from "node:child_process";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const children = [];
let closing = false;
function stop(code = 0) {
  if (closing) return;
  closing = true;
  for (const child of children) child.kill("SIGTERM");
  process.exitCode = code;
}
function launch(args) {
  const child = spawn(process.execPath, args, {
    stdio: "inherit",
    env: process.env,
  });
  children.push(child);
  child.on("exit", (code) => stop(code ?? 0));
  child.on("error", (error) => {
    console.error(error);
    stop(1);
  });
  return child;
}
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
launch([require.resolve("tsx/cli"), "apps/server/src/main.ts"]);
// The database may need a few seconds on first start. Never proxy to an unready API.
const deadline = Date.now() + 30000;
let ready = false;
while (!closing && Date.now() < deadline) {
  try {
    const response = await fetch("http://127.0.0.1:3101/health", {
      signal: AbortSignal.timeout(1000),
    });
    if (response.ok) {
      ready = true;
      break;
    }
  } catch {
    /* Still initializing the database. */
  }
  await new Promise((resolve) => setTimeout(resolve, 100));
}
if (!closing && ready) {
  launch([
    require.resolve("next/dist/bin/next"),
    "dev",
    "apps/web",
    "--hostname",
    "127.0.0.1",
    "--port",
    "3000",
  ]);
} else if (!closing) {
  console.error(
    "A API não iniciou em 30 segundos. Confira as mensagens acima.",
  );
  stop(1);
}

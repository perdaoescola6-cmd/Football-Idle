import { spawn } from "node:child_process";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
// Keep production verification separate from the live development server's output.
const child = spawn(
  process.execPath,
  [require.resolve("next/dist/bin/next"), "build", "apps/web"],
  {
    stdio: "inherit",
    env: { ...process.env, FOOTBALL_BUILD_CHECK: "1" },
  },
);
child.on("error", (error) => {
  console.error(error);
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});

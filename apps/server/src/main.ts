import "./env.js";
import { openDatabase } from "./db.js";
import { buildApp } from "./app.js";
const db = await openDatabase({ url: process.env.DATABASE_URL });
const { app, repo } = await buildApp(db, {
  logger: true,
  godMode: process.env.ENABLE_GOD_MODE !== "0",
});
let ticking = false;
const timer =
  process.env.EXTERNAL_WORKER === "1"
    ? null
    : setInterval(async () => {
        if (ticking) return;
        ticking = true;
        try {
          await repo.tick();
        } catch (error) {
          app.log.error(error, "Falha recuperável no worker");
        } finally {
          ticking = false;
        }
      }, 1000);
await app.listen({ host: "127.0.0.1", port: 3101 });
app.log.info({ database: db.mode }, "Football Idle — retro experimental E2");
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  if (timer) clearInterval(timer);
  await app.close();
  while (ticking) await new Promise((resolve) => setTimeout(resolve, 10));
  await db.close();
}
process.on("SIGINT", () => void stop());
process.on("SIGTERM", () => void stop());

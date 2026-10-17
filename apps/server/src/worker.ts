import "./env.js";
import { openDatabase } from "./db.js";
import { GameRepository } from "./repository.js";
if (!process.env.DATABASE_URL)
  throw new Error(
    "Worker separado exige DATABASE_URL. O banco embarcado usa o worker integrado à API.",
  );
const db = await openDatabase({ url: process.env.DATABASE_URL }),
  repo = new GameRepository(db);
let running = true;
process.on("SIGINT", () => {
  running = false;
});
process.on("SIGTERM", () => {
  running = false;
});
while (running) {
  try {
    await repo.tick();
  } catch (error) {
    console.error("Falha recuperável no worker", error);
  }
  await new Promise((resolve) => setTimeout(resolve, 1000));
}
await db.close();

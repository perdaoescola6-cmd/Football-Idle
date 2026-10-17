import { existsSync } from "node:fs";
// Optional local settings. Secrets stay outside versioned files.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

import { mkdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import pg from "pg";

export interface Sql {
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: T[] }>;
}
export interface Database extends Sql {
  transaction<T>(run: (tx: Sql) => Promise<T>): Promise<T>;
  close(): Promise<void>;
  mode: "embedded" | "postgres";
}
export async function openDatabase(
  options: { url?: string; directory?: string; memory?: boolean } = {},
): Promise<Database> {
  let db: Database;
  let migrate: (sql: string) => Promise<unknown>;
  if (options.url) {
    const pool = new pg.Pool({ connectionString: options.url, max: 8 });
    migrate = async (sql) => {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(sql);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    };
    db = {
      mode: "postgres",
      query: async (sql, params) => await pool.query(sql, params),
      close: () => pool.end(),
      transaction: async (run) => {
        const client = await pool.connect();
        try {
          await client.query("BEGIN");
          const result = await run(client);
          await client.query("COMMIT");
          return result;
        } catch (error) {
          await client.query("ROLLBACK");
          throw error;
        } finally {
          client.release();
        }
      },
    };
  } else {
    const directory = resolve(options.directory ?? ".data/postgres");
    if (!options.memory) await mkdir(dirname(directory), { recursive: true });
    const embedded = await PGlite.create(
      options.memory ? "memory://" : directory,
    );
    migrate = (sql) => embedded.transaction((tx) => tx.exec(sql));
    db = {
      mode: "embedded",
      query: (sql, params) => embedded.query(sql, params),
      close: () => embedded.close(),
      transaction: (run) => embedded.transaction((tx) => run(tx)),
    };
  }
  const migration = await readFile(
    new URL("../migrations/001-initial.sql", import.meta.url),
    "utf8",
  );
  // Each migration is applied once. Do not rerun DDL alongside a live worker.
  const exists = await db.query<{ name: string | null }>(
    "SELECT to_regclass('public.schema_migrations')::text AS name",
  );
  if (!exists.rows[0]?.name) {
    try {
      await migrate(migration);
    } catch (error) {
      await db.close();
      throw error;
    }
  }
  const applied = await db.query<{ version: number }>(
    "SELECT version FROM schema_migrations",
  );
  if (!applied.rows.some((r) => r.version === 2)) {
    try {
      await migrate(
        await readFile(
          new URL("../migrations/002-alpha.sql", import.meta.url),
          "utf8",
        ),
      );
    } catch (error) {
      await db.close();
      throw error;
    }
  }
  if (!applied.rows.some((r) => r.version === 3)) {
    try {
      await migrate(
        await readFile(
          new URL("../migrations/003-economy-audit.sql", import.meta.url),
          "utf8",
        ),
      );
    } catch (error) {
      await db.close();
      throw error;
    }
  }
  if (!applied.rows.some((r) => r.version === 4)) {
    try {
      await migrate(
        await readFile(
          new URL("../migrations/004-roster-scout-holds.sql", import.meta.url),
          "utf8",
        ),
      );
    } catch (error) {
      await db.close();
      throw error;
    }
  }
  if (!applied.rows.some((r) => r.version === 5)) {
    try {
      await migrate(
        await readFile(
          new URL("../migrations/005-brasfoot.sql", import.meta.url),
          "utf8",
        ),
      );
    } catch (error) {
      await db.close();
      throw error;
    }
  }
  if (!applied.rows.some((r) => r.version === 6)) {
    try {
      await migrate(
        await readFile(
          new URL("../migrations/006-football-v2.sql", import.meta.url),
          "utf8",
        ),
      );
    } catch (error) {
      await db.close();
      throw error;
    }
  }
  return db;
}

import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { drizzle as drizzlePg } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Schema = typeof schema;

export type PgJs = ReturnType<typeof postgres>;
export type PostgresDb = ReturnType<typeof drizzlePg<Schema, PgJs>>;
export type PgliteDb = ReturnType<typeof drizzlePglite<Schema, PGlite>>;
export type SparkDb = PostgresDb | PgliteDb;

export type OpenDbResult = {
  db: SparkDb;
  kind: "postgres" | "pglite";
  pglite?: PGlite;
  sql?: PgJs;
  /** Directory used for file-backed PGlite (restart survival). */
  dataDir?: string;
  close: () => Promise<void>;
};

export type OpenDbOptions = {
  databaseUrl?: string;
  pglite?: PGlite;
  dataDir?: string;
};

function isPostgresUrl(url: string | undefined): url is string {
  if (!url) return false;
  return url.startsWith("postgres://") || url.startsWith("postgresql://");
}

/**
 * DATABASE_URL=postgres://… → Postgres.
 * Otherwise PGlite (file-backed if dataDir / DATABASE_URL is a path).
 */
export async function openDb(options: OpenDbOptions = {}): Promise<OpenDbResult> {
  const databaseUrl = options.databaseUrl ?? process.env.DATABASE_URL;
  if (options.pglite) {
    const db = drizzlePglite(options.pglite, { schema });
    return {
      db,
      kind: "pglite",
      pglite: options.pglite,
      close: async () => {
        await options.pglite?.close();
      },
    };
  }
  if (isPostgresUrl(databaseUrl)) {
    const sql = postgres(databaseUrl, { max: 8 });
    const db = drizzlePg(sql, { schema });
    return {
      db,
      kind: "postgres",
      sql,
      close: async () => {
        await sql.end({ timeout: 5 });
      },
    };
  }
  const dataDir = resolve(
    options.dataDir ??
      (databaseUrl && !isPostgresUrl(databaseUrl) ? databaseUrl : undefined) ??
      process.env.PGLITE_DATA_DIR ??
      ".data/pglite"
  );
  mkdirSync(dataDir, { recursive: true });
  const pglite = new PGlite(dataDir);
  await pglite.waitReady;
  const db = drizzlePglite(pglite, { schema });
  return {
    db,
    kind: "pglite",
    pglite,
    dataDir,
    close: async () => {
      await pglite.close();
    },
  };
}

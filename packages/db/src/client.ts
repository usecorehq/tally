import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type TallyDb = ReturnType<typeof buildTallyDb>;

export type TallyDbOptions = {
  /** Connections this process may hold (default 5). */
  max?: number;
  /** Seconds to establish a connection before failing (default 10). */
  connectTimeout?: number;
};

export function buildTallyDb(connectionUrl: string, opts: TallyDbOptions = {}) {
  const client = postgres(connectionUrl, {
    // The Supabase pooler is shared with other Qorelly projects (pool_size 15):
    // keep few connections and give idle ones back, or they hold pooler slots
    // for the life of the process (postgres.js' default idle_timeout is 0) and
    // new connections (e.g. a background stock-take) wait.
    max: opts.max ?? 5,
    idle_timeout: 20,
    max_lifetime: 60 * 30,
    // Fail fast instead of waiting when the pooler has no free client slot
    // (postgres.js' default is 30 s, and queued queries wait behind it).
    connect_timeout: opts.connectTimeout ?? 10,
    // Supabase pooler enforces prepare=false; direct connections tolerate it.
    // Auto-detect from URL host suffix.
    prepare: !connectionUrl.includes("pooler.supabase"),
  });
  return drizzle(client, { schema });
}

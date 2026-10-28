import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type TallyDb = ReturnType<typeof buildTallyDb>;

export function buildTallyDb(connectionUrl: string) {
  const client = postgres(connectionUrl, {
    // The Supabase pooler is shared with other Qorelly projects (pool_size 15):
    // keep few connections and give idle ones back, or they hold pooler slots
    // forever and new connections (e.g. a background stock-take) wait.
    max: 5,
    idle_timeout: 20,
    max_lifetime: 60 * 30,
    // Fail fast instead of hanging when the pooler has no free client slot.
    connect_timeout: 15,
    // Supabase pooler enforces prepare=false; direct connections tolerate it.
    // Auto-detect from URL host suffix.
    prepare: !connectionUrl.includes("pooler.supabase"),
  });
  return drizzle(client, { schema });
}

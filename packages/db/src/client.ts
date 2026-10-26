import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type TallyDb = ReturnType<typeof buildTallyDb>;

export function buildTallyDb(connectionUrl: string) {
  const client = postgres(connectionUrl, {
    max: 10,
    // Supabase pooler enforces prepare=false; direct connections tolerate it.
    // Auto-detect from URL host suffix.
    prepare: !connectionUrl.includes("pooler.supabase"),
  });
  return drizzle(client, { schema });
}

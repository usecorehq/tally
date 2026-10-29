/**
 * Nested config read via `config.get('supabase.url')`, mapped from the env validated in env.validation.ts
 * so an env rename doesn't ripple into every consumer.
 */
export type TallyConfig = ReturnType<typeof buildConfig>;

export function buildConfig(env: NodeJS.ProcessEnv) {
  return {
    nodeEnv: (env.NODE_ENV ?? "development") as "development" | "production" | "test",
    port: parseInt(env.PORT ?? "4100", 10),
    corsOrigins: env.CORS_ORIGINS!,

    supabase: {
      url: env.SUPABASE_URL!,
      jwtSecret: env.SUPABASE_JWT_SECRET!,
      dbUrl: env.SUPABASE_DB_URL!,
      /** Connections this API process may hold; the Supabase pooler is shared (see docs/architecture/database.md). */
      dbPoolMax: env.DB_POOL_MAX ? parseInt(env.DB_POOL_MAX, 10) : undefined,
    },

    catalog: {
      /** Qore Catalog API — products the Q Vision models are trained against. */
      baseUrl: env.QORE_CATALOG_BASE_URL ?? "http://localhost:3100",
      apiKey: env.QORE_CATALOG_API_KEY!,
    },

    meta: {
      /** Meta Model API (Muse Spark, SAM 3.1) for camera recognition. Server-only key. */
      baseUrl: env.META_MODEL_BASE_URL ?? "https://api.meta.ai/v1",
      /** Unset → vision routes return 503; the rest of the API runs as normal. */
      apiKey: env.META_MODEL_API_KEY,
    },

    r2: {
      /** Cloudflare R2 (tally-media bucket) for Tally's own files: product crops. Server-only. */
      accountId: env.R2_ACCOUNT_ID,
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      bucket: env.R2_BUCKET,
    },
  };
}

export default () => buildConfig(process.env);

/**
 * Nested config namespace consumed by providers via `config.get('supabase.url')`.
 *
 * The flat process.env is validated in env.validation.ts, then this factory
 * maps it into the shape services actually read — so a rename in the env
 * doesn't ripple into every consumer.
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
  };
}

export default () => buildConfig(process.env);

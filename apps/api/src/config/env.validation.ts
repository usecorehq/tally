import { plainToInstance, Transform } from "class-transformer";
import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  validateSync,
} from "class-validator";

enum NodeEnv {
  Development = "development",
  Production = "production",
  Test = "test",
}

class EnvVars {
  @IsEnum(NodeEnv)
  @IsOptional()
  NODE_ENV: NodeEnv = NodeEnv.Development;

  @IsInt()
  @Min(0)
  @Max(65535)
  @IsOptional()
  PORT: number = 4100;

  // ── Supabase (shared Qorelly project) ──
  @IsString()
  SUPABASE_URL!: string;

  /** HS256 secret from Supabase → Project Settings → API → JWT Settings. */
  @IsString()
  SUPABASE_JWT_SECRET!: string;

  /** Postgres connection string for the shared Supabase project. */
  @IsString()
  SUPABASE_DB_URL!: string;

  /** Connections this process may hold (default 5). Keep it small: the Supabase pooler is shared. */
  @IsInt()
  @Min(1)
  @Max(20)
  @IsOptional()
  DB_POOL_MAX?: number;

  // ── Qore Catalog ──
  @IsString()
  @IsOptional()
  QORE_CATALOG_BASE_URL: string = "http://localhost:3100";

  /** Sent as x-api-key on every Catalog request. */
  @IsString()
  QORE_CATALOG_API_KEY!: string;

  // ── Meta Model API (camera recognition) ──
  @IsString()
  @IsOptional()
  META_MODEL_BASE_URL: string = "https://api.meta.ai/v1";

  /** Bearer key (LLM_…). Optional: without it only the vision routes are unavailable. */
  @IsString()
  @IsOptional()
  META_MODEL_API_KEY?: string;

  // ── Cloudflare R2 (tally-media; all four or crops are skipped) ──
  @IsString()
  @IsOptional()
  R2_ACCOUNT_ID?: string;

  @IsString()
  @IsOptional()
  R2_ACCESS_KEY_ID?: string;

  /** Token scoped to the tally-media bucket only. */
  @IsString()
  @IsOptional()
  R2_SECRET_ACCESS_KEY?: string;

  @IsString()
  @IsOptional()
  R2_BUCKET?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  @Transform(({ value }) => {
    if (Array.isArray(value)) return value;
    if (typeof value !== "string" || !value.trim()) return [];
    return value
      .split(",")
      .map((v: string) => v.trim())
      .filter((v: string) => v.length > 0);
  })
  CORS_ORIGINS: string[] = [];
}

export function validateEnv(config: Record<string, unknown>): EnvVars {
  const parsed = plainToInstance(EnvVars, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(parsed, { skipMissingProperties: false });
  if (errors.length > 0) {
    throw new Error(
      `Invalid environment configuration:\n${errors
        .map((e) => `  - ${e.property}: ${Object.values(e.constraints ?? {}).join(", ")}`)
        .join("\n")}`,
    );
  }
  return parsed;
}

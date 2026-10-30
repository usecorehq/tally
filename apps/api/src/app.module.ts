import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
import { HealthModule } from "./modules/health/health.module";
import { CatalogModule } from "./modules/catalog/catalog.module";
import { BusinessesModule } from "./modules/businesses/businesses.module";
import { MediaModule } from "./modules/media/media.module";
import { VisionModule } from "./modules/vision/vision.module";
import { UsageModule } from "./modules/usage/usage.module";
import { DrizzleModule } from "./drizzle/drizzle.module";
import { SupabaseJwtGuard } from "./common/guards/supabase-jwt.guard";
import { validateEnv } from "./config/env.validation";
import configuration from "./config/configuration";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [configuration],
      validate: validateEnv,
      // turbo runs dev/start with cwd = apps/api. An app-local .env wins key by
      // key; anything missing falls back to the single root .env.
      envFilePath: [".env", "../../.env"],
    }),
    DrizzleModule,
    CatalogModule,
    HealthModule,
    BusinessesModule,
    MediaModule,
    VisionModule,
    UsageModule,
  ],
  providers: [
    // Global auth: every route requires a valid Supabase JWT (shared Qorelly
    // auth) unless the controller or handler is decorated with @Public().
    { provide: APP_GUARD, useClass: SupabaseJwtGuard },
  ],
})
export class AppModule {}

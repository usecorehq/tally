import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerModule } from "@nestjs/throttler";
import { HealthModule } from "./modules/health/health.module";
import { CatalogModule } from "./modules/catalog/catalog.module";
import { BusinessesModule } from "./modules/businesses/businesses.module";
import { MediaModule } from "./modules/media/media.module";
import { VisionModule } from "./modules/vision/vision.module";
import { ClientsModule } from "./modules/clients/clients.module";
import { BillingModule } from "./modules/billing/billing.module";
import { DrizzleModule } from "./drizzle/drizzle.module";
import { AuthGuard } from "./common/guards/auth.guard";
import { GrantStatusService } from "./common/guards/grant-status.service";
import { AppThrottlerGuard, throttlerOptions } from "./common/guards/throttler";
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
    ThrottlerModule.forRoot(throttlerOptions),
    CatalogModule,
    HealthModule,
    BusinessesModule,
    MediaModule,
    VisionModule,
    ClientsModule,
    BillingModule,
  ],
  providers: [
    // Global auth: every route requires a Supabase user JWT, or a Connect Tally token on @Scopes routes,
    // unless marked @Public(). Guards run in this order, so the throttler sees the principal.
    GrantStatusService,
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: AppThrottlerGuard },
  ],
})
export class AppModule {}

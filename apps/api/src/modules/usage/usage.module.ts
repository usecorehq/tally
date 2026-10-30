import { Global, Module } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { BusinessesModule } from "../businesses/businesses.module";
import { UsageLimitFilter } from "./usage-errors";
import { UsageController } from "./usage.controller";
import { UsageRepository } from "./usage.repository";
import { UsageService } from "./usage.service";

// Global so the vision module can check limits without importing this one.
@Global()
@Module({
  imports: [BusinessesModule],
  controllers: [UsageController],
  providers: [UsageService, UsageRepository, { provide: APP_FILTER, useClass: UsageLimitFilter }],
  exports: [UsageService],
})
export class UsageModule {}

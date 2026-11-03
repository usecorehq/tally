import { Global, Module } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { BusinessesModule } from "../businesses/businesses.module";
import { UsageLimitFilter } from "./billing-errors";
import { BillingController } from "./billing.controller";
import { BillingRepository } from "./billing.repository";
import { BillingService } from "./billing.service";

// Plans, simulated subscriptions and usage limits. Nothing here takes payments or counts as revenue.
// Global so the vision module can check limits without importing this one.
@Global()
@Module({
  imports: [BusinessesModule],
  controllers: [BillingController],
  providers: [BillingService, BillingRepository, { provide: APP_FILTER, useClass: UsageLimitFilter }],
  exports: [BillingService],
})
export class BillingModule {}

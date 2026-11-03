import { Module } from "@nestjs/common";
import { ClientsController } from "./clients.controller";
import { ClientsRepository } from "./clients.repository";
import { ClientsService } from "./clients.service";
import { DeveloperAppsController } from "./developer-apps.controller";
import { DeveloperAppsService } from "./developer-apps.service";

@Module({
  controllers: [ClientsController, DeveloperAppsController],
  providers: [ClientsService, ClientsRepository, DeveloperAppsService],
})
export class ClientsModule {}

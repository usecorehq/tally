import { Module } from "@nestjs/common";
import { BusinessesModule } from "../businesses/businesses.module";
import { VisionController } from "./vision.controller";
import { VisionRepository } from "./vision.repository";
import { VisionService } from "./vision.service";

@Module({
  imports: [BusinessesModule],
  controllers: [VisionController],
  providers: [VisionService, VisionRepository],
})
export class VisionModule {}

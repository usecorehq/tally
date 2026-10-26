import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Public } from "../../common/decorators/public.decorator";
import { CatalogService } from "../catalog/catalog.service";

@ApiTags("health")
@Public()
@Controller("health")
export class HealthController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  @ApiOperation({ summary: "Liveness probe — always public." })
  async check() {
    const catalog = await this.catalog.client.health().catch(() => null);
    return {
      status: "ok",
      service: "tally-api",
      catalog: catalog ?? { status: "unreachable" },
      timestamp: new Date().toISOString(),
    };
  }
}

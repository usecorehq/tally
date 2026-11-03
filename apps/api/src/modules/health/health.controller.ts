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
  @ApiOperation({ summary: "Liveness probe — always public. catalog.key says whether Qore Catalog accepts Tally's key (valid, rejected, unknown)." })
  async check() {
    const [catalog, key] = await Promise.all([this.catalog.client.health().catch(() => null), this.catalog.keyStatus()]);
    return {
      status: "ok",
      service: "tally-api",
      catalog: { ...(catalog ?? { status: "unreachable" }), key },
      timestamp: new Date().toISOString(),
    };
  }
}

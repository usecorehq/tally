import { Body, Controller, Get, Header, HttpCode, Param, Patch, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser, type AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { AppParams, CreateAppBody, UpdateAppBody } from "./clients.dto";
import { DeveloperAppsService } from "./developer-apps.service";

const APP_EXAMPLE = {
  client_id: "tc_…",
  name: "Partner App",
  logo_url: null,
  status: "active",
  redirect_uris: ["https://partner.example/callback"],
  allowed_origins: ["https://partner.example"],
  scopes: ["stocktake:write", "stocktake:read"],
  secret_prefix: "AbCdEfGh",
  daily_stocktake_cap: 200,
  max_concurrent_runs: 3,
  created_at: "2026-11-01T09:00:00.000Z",
  updated_at: "2026-11-01T09:00:00.000Z",
};

// No @Scopes: the guard keeps client and embed tokens out, so only a signed-in Qorelly user reaches these.
@ApiTags("clients")
@ApiBearerAuth("bearer")
@Controller("clients/v1/apps")
export class DeveloperAppsController {
  constructor(private readonly apps: DeveloperAppsService) {}

  @Get()
  @ApiOperation({ summary: "The Connect Tally apps the caller registered, newest first." })
  @ApiOkResponse({ schema: { example: [APP_EXAMPLE] } })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.apps.list(user.sub);
  }

  @Post()
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Register an app. The client_secret is in this response only; store it now." })
  @ApiCreatedResponse({ schema: { example: { ...APP_EXAMPLE, client_secret: "tcs_…" } } })
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateAppBody) {
    return this.apps.create(user.sub, { ...body });
  }

  @Get(":clientId")
  @ApiOperation({ summary: "One of the caller's apps. Someone else's app is a 404." })
  @ApiOkResponse({ schema: { example: APP_EXAMPLE } })
  get(@CurrentUser() user: AuthenticatedUser, @Param() { clientId }: AppParams) {
    return this.apps.get(user.sub, clientId);
  }

  @Patch(":clientId")
  @ApiOperation({ summary: "Change the name, logo, redirect URIs or allowed sites. Scopes are fixed at create." })
  @ApiOkResponse({ schema: { example: APP_EXAMPLE } })
  update(@CurrentUser() user: AuthenticatedUser, @Param() { clientId }: AppParams, @Body() body: UpdateAppBody) {
    return this.apps.update(user.sub, clientId, { ...body });
  }

  @Post(":clientId/rotate-secret")
  @HttpCode(200)
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Issue a new client_secret, shown once. The old one stops working at once." })
  @ApiOkResponse({ schema: { example: { ...APP_EXAMPLE, client_secret: "tcs_…" } } })
  rotateSecret(@CurrentUser() user: AuthenticatedUser, @Param() { clientId }: AppParams) {
    return this.apps.rotateSecret(user.sub, clientId);
  }

  @Post(":clientId/suspend")
  @HttpCode(200)
  @ApiOperation({ summary: "Suspend the app and disconnect every business. Only the CTO can reactivate it." })
  @ApiOkResponse({ schema: { example: { ...APP_EXAMPLE, status: "suspended" } } })
  suspend(@CurrentUser() user: AuthenticatedUser, @Param() { clientId }: AppParams) {
    return this.apps.suspend(user.sub, clientId);
  }

  @Get(":clientId/activity")
  @ApiOperation({ summary: "Connected businesses, stock-takes today and this month (Lagos), and the app's caps." })
  @ApiOkResponse({
    schema: {
      example: {
        client_id: "tc_…",
        active_grants: 3,
        today: { used: 4, running: 0 },
        month: { stocktakes: 41, scans: 9 },
        caps: { daily_stocktake_cap: 200, max_concurrent_runs: 3 },
      },
    },
  })
  activity(@CurrentUser() user: AuthenticatedUser, @Param() { clientId }: AppParams) {
    return this.apps.activity(user.sub, clientId);
  }
}

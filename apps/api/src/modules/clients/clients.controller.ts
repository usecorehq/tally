import { Body, Controller, Delete, Get, Header, Headers, HttpCode, Param, Post, Query } from "@nestjs/common";
import {
  ApiBasicAuth,
  ApiBearerAuth,
  ApiConsumes,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { CurrentUser, type AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { Public } from "../../common/decorators/public.decorator";
import { AuthorizeInfoQuery, CreateCodeBody, GrantParams, GrantsQuery, RevokeBody, TokenBody } from "./clients.dto";
import { ClientsService } from "./clients.service";

@ApiTags("clients")
@Controller("clients/v1")
export class ClientsController {
  constructor(private readonly clients: ClientsService) {}

  @Get("oauth/authorize-info")
  @ApiBearerAuth("bearer")
  @ApiOperation({ summary: "Consent screen data: the client, the scopes asked for, and the caller's owned businesses." })
  @ApiOkResponse({
    schema: {
      example: {
        client: { client_id: "tc_…", name: "Partner App", logo_url: null },
        scopes: [{ scope: "stocktake:write", description: "Run stock-takes and update your stock" }],
        businesses: [{ id: "0b6c…", name: "My Shop", connected: false }],
      },
    },
  })
  authorizeInfo(@CurrentUser() user: AuthenticatedUser, @Query() query: AuthorizeInfoQuery) {
    return this.clients.authorizeInfo(user.sub, { ...query });
  }

  @Post("oauth/codes")
  @HttpCode(200)
  @ApiBearerAuth("bearer")
  @ApiOperation({ summary: "Approve the consent: mints a single-use authorization code (60 s). Owner only." })
  @ApiOkResponse({ schema: { example: { code: "…", expires_in: 60 } } })
  createCode(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateCodeBody) {
    return this.clients.createCode(user.sub, { ...body });
  }

  @Public()
  @Post("oauth/token")
  @HttpCode(200)
  @Header("Cache-Control", "no-store")
  @ApiBasicAuth("client")
  @ApiConsumes("application/x-www-form-urlencoded", "application/json")
  @ApiOperation({ summary: "Exchange a code (PKCE) or rotate a refresh token. Client authenticates with HTTP Basic." })
  @ApiOkResponse({
    schema: {
      example: {
        access_token: "eyJ…",
        token_type: "Bearer",
        expires_in: 900,
        refresh_token: "…",
        scope: "stocktake:write stocktake:read inventory:read",
        business_id: "0b6c…",
      },
    },
  })
  token(@Headers("authorization") authorization: string | undefined, @Body() body: TokenBody) {
    return this.clients.token(authorization, { ...body });
  }

  @Public()
  @Post("oauth/revoke")
  @HttpCode(200)
  @ApiBasicAuth("client")
  @ApiConsumes("application/x-www-form-urlencoded", "application/json")
  @ApiOperation({ summary: "Revoke the grant behind a refresh token (RFC 7009). 200 {} once the client authenticates." })
  revoke(@Headers("authorization") authorization: string | undefined, @Body() body: RevokeBody) {
    return this.clients.revoke(authorization, { ...body });
  }

  @Get("grants")
  @ApiBearerAuth("bearer")
  @ApiOperation({ summary: "Apps connected to a business (owner only)." })
  listGrants(@CurrentUser() user: AuthenticatedUser, @Query() { businessId }: GrantsQuery) {
    return this.clients.listGrants(user.sub, businessId);
  }

  @Delete("grants/:id")
  @HttpCode(204)
  @ApiBearerAuth("bearer")
  @ApiNoContentResponse()
  @ApiOperation({ summary: "Disconnect an app (owner only). Its refresh token stops working at once." })
  async revokeGrant(@CurrentUser() user: AuthenticatedUser, @Param() { id }: GrantParams) {
    await this.clients.revokeGrant(user.sub, id);
  }
}

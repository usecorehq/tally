import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsUUID } from "class-validator";

// OAuth inputs are checked by ClientsService so their errors keep the RFC 6749 body; these only describe them.

export class AuthorizeInfoQuery {
  @ApiPropertyOptional({ example: "tc_0123456789abcdefghijklmn" })
  @IsOptional()
  client_id?: unknown;

  @ApiPropertyOptional({ example: "https://partner.example/callback" })
  @IsOptional()
  redirect_uri?: unknown;

  @ApiPropertyOptional({ example: "stocktake:write stocktake:read inventory:read", description: "Space-separated" })
  @IsOptional()
  scope?: unknown;
}

export class CreateCodeBody extends AuthorizeInfoQuery {
  @ApiPropertyOptional({ description: "The business the merchant owns and is connecting" })
  @IsOptional()
  business_id?: unknown;

  @ApiPropertyOptional({ description: "base64url(sha256(code_verifier)), 43 chars" })
  @IsOptional()
  code_challenge?: unknown;

  @ApiPropertyOptional({ enum: ["S256"] })
  @IsOptional()
  code_challenge_method?: unknown;
}

export class TokenBody {
  @ApiPropertyOptional({ enum: ["authorization_code", "refresh_token"] })
  @IsOptional()
  grant_type?: unknown;

  @ApiPropertyOptional({ description: "authorization_code only" })
  @IsOptional()
  code?: unknown;

  @ApiPropertyOptional({ description: "authorization_code only; the same redirect_uri as the consent request" })
  @IsOptional()
  redirect_uri?: unknown;

  @ApiPropertyOptional({ description: "authorization_code only; the PKCE verifier (43-128 chars)" })
  @IsOptional()
  code_verifier?: unknown;

  @ApiPropertyOptional({ description: "refresh_token only" })
  @IsOptional()
  refresh_token?: unknown;
}

export class RevokeBody {
  @ApiPropertyOptional({ description: "The refresh token to revoke" })
  @IsOptional()
  token?: unknown;
}

export class GrantsQuery {
  @ApiProperty()
  @IsUUID()
  businessId!: string;
}

export class GrantParams {
  @ApiProperty()
  @IsUUID()
  id!: string;
}

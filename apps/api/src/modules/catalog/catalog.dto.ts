import { ApiPropertyOptional, ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, Length, Matches, Max, Min } from "class-validator";
import { QID_PATTERN } from "@tally/catalog-client";

export const SUBTYPE_CODE_PATTERN = /^[a-z0-9_]{2,60}$/;

export class SubtypeParams {
  @ApiProperty({ example: "supermarket" })
  @Matches(SUBTYPE_CODE_PATTERN, { message: "code must be 2-60 lowercase letters, digits or underscores" })
  code!: string;
}

export class TemplatesQuery {
  @ApiPropertyOptional({ minimum: 0, maximum: 5, default: 0, description: "Catalogue product suggestions per template item" })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(5)
  suggestions?: number;
}

export class ProductSearchQuery {
  @ApiPropertyOptional({ example: "peak milk", minLength: 2, maxLength: 200 })
  @IsOptional()
  @IsString()
  @Length(2, 200)
  q?: string;

  @ApiPropertyOptional({ example: "peak", description: "Brand slug" })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  brand?: string;

  @ApiPropertyOptional({ example: "food/dairy", description: "Category path" })
  @IsOptional()
  @IsString()
  @Length(1, 200)
  category?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 10000, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10000)
  offset?: number;
}

export class ProductParams {
  @ApiProperty({ example: "QC-7K2M-9XQ4-R" })
  @Matches(QID_PATTERN, { message: "qid must be a Qore ID like QC-7K2M-9XQ4-R" })
  qid!: string;
}

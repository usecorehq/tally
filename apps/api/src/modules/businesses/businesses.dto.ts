import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from "class-validator";
import { QID_PATTERN } from "@tally/catalog-client";
import { SUBTYPE_CODE_PATTERN } from "../catalog/catalog.dto";
import { BARCODE_PATTERN } from "./barcode";

/** Naira with up to 2 decimals, as a string so it never passes through a float. */
export const NAIRA_PATTERN = /^\d{1,10}(\.\d{1,2})?$/;
export const MAX_STARTER_ITEMS = 200;

export class CreateBusinessBody {
  @ApiProperty({ example: "Mama Nkechi Supermarket" })
  @IsString()
  @Length(1, 120)
  name!: string;

  @ApiProperty({ example: "supermarket", description: "Qore Catalog sub-type code (GET /api/catalog/verticals)" })
  @Matches(SUBTYPE_CODE_PATTERN, { message: "subtypeCode must be 2-60 lowercase letters, digits or underscores" })
  subtypeCode!: string;
}

export class BusinessParams {
  @ApiProperty()
  @IsUUID()
  businessId!: string;
}

export class BarcodeParams extends BusinessParams {
  @ApiProperty({ example: "6156000024013" })
  @Matches(BARCODE_PATTERN, { message: "code must be 4-64 letters, digits, dots or dashes" })
  code!: string;
}

export class ItemParams extends BusinessParams {
  @ApiProperty()
  @IsUUID()
  itemId!: string;
}

export class SetBarcodeBody {
  @ApiProperty({ nullable: true, example: "6156000024013", description: "null unlinks the barcode" })
  @ValidateIf((_, v) => v !== null)
  @Matches(BARCODE_PATTERN, { message: "barcode must be 4-64 letters, digits, dots or dashes" })
  barcode!: string | null;
}

export const STARTER_OUTCOMES = ["accepted", "corrected", "new_item", "removed"] as const;
export type StarterOutcome = (typeof STARTER_OUTCOMES)[number];

export class StarterItem {
  @ApiProperty({ description: "Client-generated id; makes retries safe (stock + catalogue feedback)", example: "tpl-7f3a…" })
  @IsString()
  @Length(1, 100)
  clientRef!: string;

  @ApiProperty({ description: "The template item as shown", example: "Rice (Bag)" })
  @IsString()
  @Length(1, 200)
  templateItemName!: string;

  @ApiProperty({ enum: STARTER_OUTCOMES })
  @IsIn(STARTER_OUTCOMES)
  outcome!: StarterOutcome;

  @ApiPropertyOptional({ description: "The catalogue's suggestion for this item, if any", example: "QC-7K2M-9XQ4-R" })
  @IsOptional()
  @Matches(QID_PATTERN)
  suggestedQid?: string;

  @ApiPropertyOptional({ minimum: 0, maximum: 1 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  suggestedScore?: number;

  @ApiPropertyOptional({ description: "corrected: the product the merchant picked instead" })
  @IsOptional()
  @Matches(QID_PATTERN)
  qid?: string;

  @ApiPropertyOptional({ description: "Name to stock it under (required unless removed)", example: "Big Bull Rice 25kg" })
  @IsOptional()
  @IsString()
  @Length(1, 200)
  name?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @Length(1, 100) variantLabel?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) sizeValue?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(1, 20) sizeUnit?: string;
  @ApiPropertyOptional({ minimum: 1 }) @IsOptional() @IsInt() @Min(1) @Max(10000) packQty?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(1, 200) categoryPath?: string;

  @ApiPropertyOptional({ description: "Price in ₦ (required unless removed)", example: "45000.00" })
  @IsOptional()
  @Matches(NAIRA_PATTERN, { message: "price must be Naira with up to 2 decimals, e.g. 4500 or 4500.50" })
  price?: string;

  @ApiPropertyOptional({ description: "Opening stock count", minimum: 0 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  @Max(1_000_000)
  openingQuantity?: number;
}

export class StarterInventoryBody {
  @ApiProperty({ type: [StarterItem] })
  @ValidateNested({ each: true })
  @Type(() => StarterItem)
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_STARTER_ITEMS)
  items!: StarterItem[];
}

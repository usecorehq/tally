import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsDefined,
  IsIn,
  IsInt,
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
import { BusinessParams, NAIRA_PATTERN } from "../businesses/businesses.dto";
import { CONFIRM_ACTIONS, type ConfirmAction } from "./confirm-plan";
import { MAX_PRODUCTS } from "./shelf-reader";

export class ScanParams extends BusinessParams {
  @ApiProperty()
  @IsUUID()
  scanId!: string;
}

export class ConfirmDecision {
  @ApiProperty({ description: "A detection id from the scan" })
  @IsUUID()
  detectionId!: string;

  @ApiProperty({
    enum: CONFIRM_ACTIONS,
    description:
      "restock: add stock to an active item (itemId). restore: un-archive a removed item (itemId) and stock it. add: create the merchant's copy (name + price; qid when picked from the catalogue). skip: stock nothing.",
  })
  @IsIn(CONFIRM_ACTIONS)
  action!: ConfirmAction;

  @ApiPropertyOptional({ description: "restock / restore: the item. Usually the detection's inventoryItemId." })
  @ValidateIf((d: ConfirmDecision) => d.action === "restock" || d.action === "restore")
  @IsUUID()
  itemId?: string;

  @ApiPropertyOptional({
    description:
      "add: the catalogue product picked (omit for a new item). restock: links a hand-typed item to this product so later scans match exactly.",
    example: "QC-7K2M-9XQ4-R",
  })
  @IsOptional()
  @Matches(QID_PATTERN)
  qid?: string;

  @ApiPropertyOptional({ description: "add: the name to stock it under (prefill from the candidate or the label)", example: "Peak Full Cream Milk Powder 400g" })
  @ValidateIf((d: ConfirmDecision) => d.action === "add")
  @IsString()
  @Length(1, 200)
  name?: string;

  @ApiPropertyOptional({ description: "add: selling price in ₦ (prefill from the candidate's indicative median)", example: "4500" })
  @ValidateIf((d: ConfirmDecision) => d.action === "add")
  @Matches(NAIRA_PATTERN, { message: "price must be Naira with up to 2 decimals, e.g. 4500 or 4500.50" })
  price?: string;

  @ApiPropertyOptional({ description: "Units to add to stock (the detection's count, as corrected). Required unless skip.", minimum: 0 })
  @ValidateIf((d: ConfirmDecision) => d.action !== "skip")
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  quantity?: number;
}

export class ConfirmBody {
  @ApiProperty({ type: [ConfirmDecision] })
  @ValidateNested({ each: true })
  @Type(() => ConfirmDecision)
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_PRODUCTS)
  decisions!: ConfirmDecision[];
}

export class LabelReading {
  @ApiProperty({ description: "As returned in identify's reading ('' when not legible)", example: "Closeup" })
  @IsString()
  @Length(0, 120)
  brand!: string;

  @ApiProperty({ example: "Toothpaste" })
  @IsString()
  @Length(1, 120)
  name!: string;

  @ApiProperty({ example: "130g" })
  @IsString()
  @Length(0, 120)
  pack!: string;
}

export class IdentifyConfirmBody {
  @ApiProperty({ type: LabelReading, description: "The reading identify returned, unchanged" })
  @IsDefined()
  @ValidateNested()
  @Type(() => LabelReading)
  reading!: LabelReading;

  @ApiProperty({ description: "The item the merchant confirmed it is (active)" })
  @IsUUID()
  itemId!: string;
}

export class RunParams extends BusinessParams {
  @ApiProperty()
  @IsUUID()
  runId!: string;
}

export class HistoryQuery {
  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

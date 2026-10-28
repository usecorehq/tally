import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseFilePipeBuilder,
  Post,
  UploadedFile,
  UseFilters,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser, type AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { BusinessParams } from "../businesses/businesses.dto";
import { VisionExceptionFilter } from "./vision-errors";
import { ConfirmBody, ScanParams } from "./vision.dto";
import { VisionService } from "./vision.service";

export const MAX_SHELF_IMAGE_BYTES = 4 * 1024 * 1024;

type UploadedImage = { buffer: Buffer; size: number };

@ApiTags("vision")
@ApiBearerAuth("bearer")
@UseFilters(VisionExceptionFilter)
@Controller("businesses/:businessId/vision")
export class VisionController {
  constructor(private readonly vision: VisionService) {}

  @Post("shelf-scans")
  @HttpCode(200)
  // fileSize + 1 so an oversized upload reaches the pipe below and gets a 413, not multer's generic error.
  @UseInterceptors(FileInterceptor("image", { limits: { fileSize: MAX_SHELF_IMAGE_BYTES + 1, files: 1 } }))
  @ApiConsumes("multipart/form-data")
  @ApiBody({ schema: { type: "object", properties: { image: { type: "string", format: "binary" } }, required: ["image"] } })
  @ApiOperation({
    summary:
      "Recognise the products in a shelf photo (JPEG/PNG/WebP, ≤ 4 MB, ~1600 px long edge): Muse Spark reads them, Qore Catalog matches them with indicative prices. Nothing is stored yet.",
  })
  @ApiOkResponse({
    schema: {
      example: {
        model: "muse-spark-1.3",
        catalogueAvailable: true,
        timings: { readMs: 6100, matchMs: 420, totalMs: 6520 },
        detections: [
          {
            id: "3f0c…",
            brand: "Peak",
            name: "Full Cream Milk Powder",
            pack: "400g",
            count: 6,
            boxes: [{ x1: 102, y1: 210, x2: 180, y2: 395 }],
            confidence: "high",
            inventoryItemId: null,
            candidates: [{ qid: "QC-7K2M-9XQ4-R", name: "Peak Full Cream Milk Powder", score: 0.94, price: { median: 4500, min: 4200, max: 5100 } }],
          },
        ],
      },
    },
  })
  shelfScan(
    @CurrentUser() user: AuthenticatedUser,
    @Param() { businessId }: BusinessParams,
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addMaxSizeValidator({ maxSize: MAX_SHELF_IMAGE_BYTES, message: "Image must be 4 MB or smaller" })
        .build({ errorHttpStatusCode: 413, fileIsRequired: false }),
    )
    file: UploadedImage | undefined,
  ) {
    if (!file) throw new BadRequestException("Send the photo as multipart field 'image'");
    return this.vision.recogniseShelf(businessId, user.sub, file.buffer);
  }

  @Get("shelf-scans/:scanId")
  @ApiOperation({ summary: "A stored shelf scan: detections, counts, candidate Qore IDs + scores, inventory match and decisions." })
  getScan(@CurrentUser() user: AuthenticatedUser, @Param() { businessId, scanId }: ScanParams) {
    return this.vision.getScan(businessId, user.sub, scanId);
  }

  @Post("shelf-scans/:scanId/confirm")
  @HttpCode(200)
  @ApiOperation({
    summary:
      "Apply the merchant's decisions: restock an item, restore a removed one, add their own copy (never a duplicate), or skip. Remembers each reading for later scans and sends photo feedback to Qore Catalog. Safe to retry.",
  })
  @ApiOkResponse({
    schema: {
      example: {
        created: 2,
        restocked: 3,
        restored: 0,
        skipped: 1,
        alreadyDecided: 0,
        invalid: [],
        scanConfirmed: true,
        feedback: { sent: 6, recorded: 6, duplicates: 0 },
      },
    },
  })
  confirm(@CurrentUser() user: AuthenticatedUser, @Param() { businessId, scanId }: ScanParams, @Body() body: ConfirmBody) {
    return this.vision.confirm(businessId, user.sub, scanId, body.decisions);
  }
}

import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put } from "@nestjs/common";
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser, type AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { Scopes } from "../../common/decorators/scopes.decorator";
import {
  BarcodeParams,
  BusinessParams,
  CreateBusinessBody,
  ItemParams,
  SetBarcodeBody,
  StarterInventoryBody,
} from "./businesses.dto";
import { BusinessesService } from "./businesses.service";

@ApiTags("businesses")
@ApiBearerAuth("bearer")
@Controller("businesses")
export class BusinessesController {
  constructor(private readonly businesses: BusinessesService) {}

  @Post()
  @ApiOperation({ summary: "Create a business; the caller becomes its owner. subtypeCode must exist in Qore Catalog." })
  @ApiCreatedResponse({
    schema: {
      example: {
        id: "0b6c…",
        name: "Mama Nkechi Supermarket",
        verticalCode: "retail",
        subtypeCode: "supermarket",
        currency: "NGN",
      },
    },
  })
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateBusinessBody) {
    return this.businesses.create(user.sub, body.name.trim(), body.subtypeCode);
  }

  @Get()
  @ApiOperation({ summary: "Businesses the caller belongs to, with their role." })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.businesses.listForUser(user.sub);
  }

  @Get(":businessId")
  @Scopes("inventory:read")
  @ApiOperation({ summary: "One business (members only)." })
  get(@CurrentUser() user: AuthenticatedUser, @Param() { businessId }: BusinessParams) {
    return this.businesses.getForMember(businessId, user.sub);
  }

  @Get(":businessId/inventory")
  @Scopes("inventory:read")
  @ApiOperation({ summary: "The business's inventory, by name (members only)." })
  inventory(@CurrentUser() user: AuthenticatedUser, @Param() { businessId }: BusinessParams) {
    return this.businesses.listInventory(businessId, user.sub);
  }

  @Get(":businessId/inventory/barcode/:code")
  @Scopes("inventory:read")
  @ApiOperation({ summary: "Find the item with this barcode (scan to find). 404 when no active item has it." })
  findByBarcode(@CurrentUser() user: AuthenticatedUser, @Param() { businessId, code }: BarcodeParams) {
    return this.businesses.findByBarcode(businessId, user.sub, code);
  }

  @Delete(":businessId/inventory/:itemId")
  @ApiOperation({
    summary:
      "Remove an item from the shop. It is archived, not deleted: it keeps its Qore ID, name, price and history, and a shelf scan of the same product offers to restore it. 404 when no active item has this id.",
  })
  archive(@CurrentUser() user: AuthenticatedUser, @Param() { businessId, itemId }: ItemParams) {
    return this.businesses.archiveItem(businessId, user.sub, itemId);
  }

  @Put(":businessId/inventory/:itemId/barcode")
  @ApiOperation({ summary: "Link a barcode to an item (null unlinks). 409 when another item already has it." })
  setBarcode(
    @CurrentUser() user: AuthenticatedUser,
    @Param() { businessId, itemId }: ItemParams,
    @Body() { barcode }: SetBarcodeBody,
  ) {
    return this.businesses.setBarcode(businessId, user.sub, itemId, barcode);
  }

  @Post(":businessId/inventory/starter")
  @HttpCode(200)
  @ApiOperation({
    summary:
      "Apply the onboarding template step: kept items become inventory (with opening stock), every decision is sent to Qore Catalog as feedback. Safe to retry.",
  })
  @ApiOkResponse({
    schema: {
      example: { created: 30, skipped: 0, removed: 7, invalid: [], feedback: { sent: 37, recorded: 37, duplicates: 0 } },
    },
  })
  starter(
    @CurrentUser() user: AuthenticatedUser,
    @Param() { businessId }: BusinessParams,
    @Body() body: StarterInventoryBody,
  ) {
    return this.businesses.addStarterInventory(businessId, user.sub, body.items);
  }
}

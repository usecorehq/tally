import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { CatalogClient } from "@tally/catalog-client";

@Injectable()
export class CatalogService {
  readonly client: CatalogClient;

  constructor(config: ConfigService) {
    this.client = new CatalogClient(
      config.getOrThrow<string>("catalog.baseUrl"),
      config.getOrThrow<string>("catalog.apiKey"),
    );
  }
}

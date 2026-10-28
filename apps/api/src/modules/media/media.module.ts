import { Global, Module } from "@nestjs/common";
import { R2Storage } from "./r2-storage";

@Global()
@Module({
  providers: [R2Storage],
  exports: [R2Storage],
})
export class MediaModule {}

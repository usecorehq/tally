import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { buildTallyDb, type TallyDb } from "@tally/db";

export const TALLY_DB = Symbol("TALLY_DB");
export type { TallyDb };

@Global()
@Module({
  providers: [
    {
      provide: TALLY_DB,
      useFactory: (config: ConfigService): TallyDb => {
        const url = config.getOrThrow<string>("supabase.dbUrl");
        return buildTallyDb(url, { max: config.get<number>("supabase.dbPoolMax") });
      },
      inject: [ConfigService],
    },
  ],
  exports: [TALLY_DB],
})
export class DrizzleModule {}

import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { PrismaModule } from "./database/prisma.module";
import { RedisModule } from "./redis/redis.module";
import { EventsModule } from "./modules/events/events.module";
import { IngestionModule } from "./modules/ingestion/ingestion.module";
import { OpsModule } from "./modules/ops/ops.module";
import { ReportsModule } from "./modules/reports/reports.module";
import { StocksModule } from "./modules/stocks/stocks.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env", "../../.env"]
    }),
    PrismaModule,
    RedisModule,
    OpsModule,
    StocksModule,
    EventsModule,
    ReportsModule,
    IngestionModule
  ]
})
export class AppModule {}

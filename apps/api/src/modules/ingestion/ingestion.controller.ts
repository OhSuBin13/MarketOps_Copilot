import { Body, Controller, Post } from "@nestjs/common";
import { ApiBody, ApiCreatedResponse, ApiTags } from "@nestjs/swagger";

import { IngestionJobType } from "../../common/market.enums";
import { CreateIngestionJobDto } from "./dto/create-ingestion-job.dto";
import { IngestionService } from "./ingestion.service";

@ApiTags("ingestion")
@Controller("ingestion")
export class IngestionController {
  constructor(private readonly ingestionService: IngestionService) {}

  @Post("jobs")
  @ApiBody({ type: CreateIngestionJobDto })
  @ApiCreatedResponse({
    description: "Create and run a market data ingestion job.",
    schema: {
      example: {
        data: {
          id: "44444444-4444-4444-8444-444444444444",
          jobType: IngestionJobType.PRICE_DAILY,
          status: "succeeded",
          parameters: {
            symbols: ["005930"],
            from: "2026-05-01",
            to: "2026-05-30"
          },
          startedAt: "2026-05-30T00:00:00.000Z",
          finishedAt: "2026-05-30T00:00:01.000Z",
          errorMessage: null,
          createdAt: "2026-05-30T00:00:00.000Z",
          summary: {
            stocksUpserted: 1,
            pricesUpserted: 20,
            documentsUpserted: 0,
            sourceErrors: []
          }
        },
        meta: { source: "database" }
      }
    }
  })
  createJob(@Body() dto: CreateIngestionJobDto): Promise<Record<string, unknown>> {
    return this.ingestionService.createJob(dto);
  }
}

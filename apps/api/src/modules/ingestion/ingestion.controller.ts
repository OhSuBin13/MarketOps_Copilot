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
    description: "Create a placeholder ingestion job request.",
    schema: {
      example: {
        data: {
          id: "44444444-4444-4444-8444-444444444444",
          jobType: IngestionJobType.STOCK_MASTER,
          status: "queued",
          parameters: {
            symbols: ["005930", "000660"]
          },
          createdAt: "2026-05-30T00:00:00.000Z"
        },
        meta: { source: "week_1_placeholder" }
      }
    }
  })
  createJob(@Body() dto: CreateIngestionJobDto): Record<string, unknown> {
    return this.ingestionService.createJob(dto);
  }
}

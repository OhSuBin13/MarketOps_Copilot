import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { ApiBody, ApiCreatedResponse, ApiOkResponse, ApiParam, ApiTags } from "@nestjs/swagger";

import { CreateReportDto } from "./dto/create-report.dto";
import { ReportsService } from "./reports.service";

@ApiTags("reports")
@Controller("reports")
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post()
  @ApiBody({ type: CreateReportDto })
  @ApiCreatedResponse({
    description: "Create an AI report draft request.",
    schema: {
      example: {
        data: {
          id: "33333333-3333-4333-8333-333333333333",
          stockId: "11111111-1111-4111-8111-111111111111",
          eventId: "22222222-2222-4222-8222-222222222222",
          prompt: "Summarize the latest market event using stored evidence only.",
          reportBody: "Week 1 placeholder. RAG-backed report generation is planned for MVP week 5.",
          sourceIds: [],
          modelName: "not_configured_week_1",
          createdAt: "2026-05-30T00:00:00.000Z"
        },
        meta: { source: "week_1_placeholder" }
      }
    }
  })
  create(@Body() dto: CreateReportDto): Record<string, unknown> {
    return this.reportsService.create(dto);
  }

  @Get(":id")
  @ApiParam({ name: "id", example: "33333333-3333-4333-8333-333333333333" })
  @ApiOkResponse({
    description: "Get one generated or placeholder report.",
    schema: {
      example: {
        data: {
          id: "33333333-3333-4333-8333-333333333333",
          stockId: "11111111-1111-4111-8111-111111111111",
          eventId: null,
          prompt: "Generate a grounded market event summary.",
          reportBody: "Week 1 placeholder. RAG-backed report generation is planned for MVP week 5.",
          sourceIds: [],
          modelName: "not_configured_week_1",
          createdAt: "2026-05-30T00:00:00.000Z"
        },
        meta: { source: "week_1_placeholder" }
      }
    }
  })
  findOne(@Param("id") id: string): Record<string, unknown> {
    return this.reportsService.findOne(id);
  }
}

import { randomUUID } from "node:crypto";

import { Injectable } from "@nestjs/common";

import { CreateReportDto } from "./dto/create-report.dto";

@Injectable()
export class ReportsService {
  create(dto: CreateReportDto): Record<string, unknown> {
    return {
      data: {
        id: randomUUID(),
        stockId: dto.stockId,
        eventId: dto.eventId ?? null,
        prompt: dto.prompt ?? "Generate a grounded market event summary.",
        reportBody: "Week 1 placeholder. RAG-backed report generation is planned for MVP week 5.",
        sourceIds: [],
        modelName: "not_configured_week_1",
        createdAt: new Date().toISOString()
      },
      meta: {
        source: "week_1_placeholder"
      }
    };
  }

  findOne(id: string): Record<string, unknown> {
    return {
      data: {
        id,
        stockId: "11111111-1111-4111-8111-111111111111",
        eventId: null,
        prompt: "Generate a grounded market event summary.",
        reportBody: "Week 1 placeholder. RAG-backed report generation is planned for MVP week 5.",
        sourceIds: [],
        modelName: "not_configured_week_1",
        createdAt: "2026-05-30T00:00:00.000Z"
      },
      meta: {
        source: "week_1_placeholder"
      }
    };
  }
}

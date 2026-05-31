import { randomUUID } from "node:crypto";

import { Injectable } from "@nestjs/common";

import { CreateIngestionJobDto } from "./dto/create-ingestion-job.dto";

@Injectable()
export class IngestionService {
  createJob(dto: CreateIngestionJobDto): Record<string, unknown> {
    return {
      data: {
        id: randomUUID(),
        jobType: dto.jobType,
        status: "queued",
        parameters: dto.parameters ?? null,
        createdAt: new Date().toISOString()
      },
      meta: {
        source: "week_1_placeholder"
      }
    };
  }
}

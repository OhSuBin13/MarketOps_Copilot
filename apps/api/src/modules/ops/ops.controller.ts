import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";

import { HealthResponse, OpsService } from "./ops.service";

@ApiTags("ops")
@Controller("ops")
export class OpsController {
  constructor(private readonly opsService: OpsService) {}

  @Get("health")
  @ApiOkResponse({
    description: "API, database, and Redis health snapshot.",
    schema: {
      example: {
        service: "marketops-api",
        status: "ok",
        timestamp: "2026-05-30T00:00:00.000Z",
        dependencies: {
          database: { ok: true, latencyMs: 4 },
          redis: { ok: true, latencyMs: 2 }
        }
      }
    }
  })
  health(): Promise<HealthResponse> {
    return this.opsService.health();
  }

  @Get("metrics")
  @ApiOkResponse({
    description: "Initial operational metrics placeholder for the MVP.",
    schema: {
      example: {
        service: "marketops-api",
        uptimeSeconds: 42,
        nodeVersion: "v22.12.0",
        memoryRssMb: 95,
        timestamp: "2026-05-30T00:00:00.000Z"
      }
    }
  })
  metrics(): Record<string, unknown> {
    return this.opsService.metrics();
  }
}

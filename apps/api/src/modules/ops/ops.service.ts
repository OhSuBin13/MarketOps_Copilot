import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../database/prisma.service";
import { DependencyCheck, RedisService } from "../../redis/redis.service";

export interface HealthResponse {
  service: string;
  status: "ok" | "degraded";
  timestamp: string;
  dependencies: {
    database: DependencyCheck;
    redis: DependencyCheck;
  };
}

@Injectable()
export class OpsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService
  ) {}

  async health(): Promise<HealthResponse> {
    const [database, redis] = await Promise.all([this.checkDatabase(), this.redis.ping()]);

    return {
      service: "marketops-api",
      status: database.ok && redis.ok ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      dependencies: {
        database,
        redis
      }
    };
  }

  metrics(): Record<string, unknown> {
    const memoryUsage = process.memoryUsage();

    return {
      service: "marketops-api",
      uptimeSeconds: Math.round(process.uptime()),
      nodeVersion: process.version,
      memoryRssMb: Math.round(memoryUsage.rss / 1024 / 1024),
      timestamp: new Date().toISOString()
    };
  }

  private async checkDatabase(): Promise<DependencyCheck> {
    const startedAt = Date.now();

    try {
      await this.prisma.$queryRaw`SELECT 1`;

      return {
        ok: true,
        latencyMs: Date.now() - startedAt
      };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown database error"
      };
    }
  }
}

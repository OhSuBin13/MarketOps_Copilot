import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";

import { DEFAULT_REDIS_URL } from "../common/default-env";

export interface DependencyCheck {
  ok: boolean;
  latencyMs?: number;
  error?: string;
}

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client: Redis;

  constructor(configService: ConfigService) {
    this.client = new Redis(configService.get<string>("REDIS_URL", DEFAULT_REDIS_URL), {
      lazyConnect: true,
      maxRetriesPerRequest: 1
    });

    this.client.on("error", () => undefined);
  }

  async ping(): Promise<DependencyCheck> {
    const startedAt = Date.now();

    try {
      if (this.client.status === "wait" || this.client.status === "end") {
        await this.client.connect();
      }

      const result = await this.client.ping();

      return {
        ok: result === "PONG",
        latencyMs: Date.now() - startedAt
      };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown Redis error"
      };
    }
  }

  onModuleDestroy(): void {
    if (this.client.status !== "end") {
      this.client.disconnect();
    }
  }
}

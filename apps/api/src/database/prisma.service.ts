import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

import { DEFAULT_DATABASE_URL } from "../common/default-env";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor() {
    super({
      datasources: {
        db: {
          url: process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL
        }
      },
      log: process.env.NODE_ENV === "production" ? ["error"] : ["warn", "error"]
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}

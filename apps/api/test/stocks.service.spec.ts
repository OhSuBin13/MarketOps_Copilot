import { describe, expect, it, jest } from "@jest/globals";
import { NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { StocksService } from "../src/modules/stocks/stocks.service";

describe("StocksService", () => {
  const now = new Date("2026-05-30T00:00:00.000Z");

  it("returns DB-backed stock list records", async () => {
    const prisma = {
      stock: {
        findMany: jest.fn().mockImplementation(() =>
          Promise.resolve([
          {
            id: "stock-id",
            symbol: "005930",
            name: "Samsung Electronics",
            market: "KRX",
            sector: "Semiconductors",
            isActive: true,
            createdAt: now,
            updatedAt: now
          }
          ])
        )
      }
    };
    const service = new StocksService(prisma as any);

    const result = (await service.findAll()) as { data: Array<{ symbol: string }>; meta: { count: number } };

    expect(result.meta).toEqual({ count: 1, source: "database" });
    expect(result.data[0].symbol).toBe("005930");
    expect(prisma.stock.findMany).toHaveBeenCalledWith({
      orderBy: [{ market: "asc" }, { symbol: "asc" }]
    });
  });

  it("returns stored daily prices with serializable number fields", async () => {
    const prisma = {
      stock: {
        findUnique: jest.fn().mockImplementation(() => Promise.resolve({ id: "stock-id" }))
      },
      priceDaily: {
        findMany: jest.fn().mockImplementation(() =>
          Promise.resolve([
          {
            id: "price-id",
            stockId: "stock-id",
            tradeDate: new Date("2026-05-29T00:00:00.000Z"),
            openPrice: new Prisma.Decimal("75000"),
            highPrice: new Prisma.Decimal("76000"),
            lowPrice: new Prisma.Decimal("74400"),
            closePrice: new Prisma.Decimal("75500"),
            volume: 12500000n,
            source: "stooq",
            createdAt: now
          }
          ])
        )
      }
    };
    const service = new StocksService(prisma as any);

    const result = (await service.findPrices("stock-id", {
      from: "2026-05-01",
      to: "2026-05-30"
    })) as {
      data: Array<{ closePrice: string; volume: string; tradeDate: string }>;
      meta: { count: number };
    };

    expect(result.meta.count).toBe(1);
    expect(result.data[0]).toMatchObject({
      tradeDate: "2026-05-29",
      closePrice: "75500",
      volume: "12500000"
    });
    expect(prisma.priceDaily.findMany).toHaveBeenCalledWith({
      where: {
        stockId: "stock-id",
        tradeDate: {
          gte: new Date("2026-05-01T00:00:00.000Z"),
          lte: new Date("2026-05-30T00:00:00.000Z")
        }
      },
      orderBy: {
        tradeDate: "asc"
      }
    });
  });

  it("throws not found when a requested stock does not exist", async () => {
    const prisma = {
      stock: {
        findUnique: jest.fn().mockImplementation(() => Promise.resolve(null))
      }
    };
    const service = new StocksService(prisma as any);

    await expect(service.findOne("missing-id")).rejects.toBeInstanceOf(NotFoundException);
  });
});

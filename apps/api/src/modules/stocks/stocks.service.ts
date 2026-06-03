import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { DateRangeQueryDto } from "../../common/dto/date-range-query.dto";
import { PrismaService } from "../../database/prisma.service";

@Injectable()
export class StocksService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<Record<string, unknown>> {
    const stocks = await this.prisma.stock.findMany({
      orderBy: [{ market: "asc" }, { symbol: "asc" }]
    });

    return {
      data: stocks.map((stock) => this.formatStock(stock)),
      meta: {
        count: stocks.length,
        source: "database"
      }
    };
  }

  async findOne(id: string): Promise<Record<string, unknown>> {
    const stock = await this.prisma.stock.findUnique({
      where: { id }
    });
    if (!stock) {
      throw new NotFoundException(`Stock not found: ${id}`);
    }

    return {
      data: this.formatStock(stock),
      meta: {
        source: "database"
      }
    };
  }

  async findPrices(id: string, range: DateRangeQueryDto): Promise<Record<string, unknown>> {
    const stock = await this.prisma.stock.findUnique({
      where: { id },
      select: { id: true }
    });
    if (!stock) {
      throw new NotFoundException(`Stock not found: ${id}`);
    }

    const prices = await this.prisma.priceDaily.findMany({
      where: {
        stockId: id,
        tradeDate: {
          gte: range.from ? this.dateOnly(range.from) : undefined,
          lte: range.to ? this.dateOnly(range.to) : undefined
        }
      },
      orderBy: {
        tradeDate: "asc"
      }
    });

    return {
      data: prices.map((price) => this.formatPrice(price)),
      meta: {
        stockId: id,
        from: range.from ?? null,
        to: range.to ?? null,
        count: prices.length,
        source: "database"
      }
    };
  }

  private formatStock(stock: {
    id: string;
    symbol: string;
    name: string;
    market: string;
    sector: string | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): Record<string, unknown> {
    return {
      id: stock.id,
      symbol: stock.symbol,
      name: stock.name,
      market: stock.market,
      sector: stock.sector,
      isActive: stock.isActive,
      createdAt: stock.createdAt.toISOString(),
      updatedAt: stock.updatedAt.toISOString()
    };
  }

  private formatPrice(price: {
    id: string;
    stockId: string;
    tradeDate: Date;
    openPrice: Prisma.Decimal;
    highPrice: Prisma.Decimal;
    lowPrice: Prisma.Decimal;
    closePrice: Prisma.Decimal;
    volume: bigint;
    source: string | null;
    createdAt: Date;
  }): Record<string, unknown> {
    return {
      id: price.id,
      stockId: price.stockId,
      tradeDate: price.tradeDate.toISOString().slice(0, 10),
      openPrice: price.openPrice.toString(),
      highPrice: price.highPrice.toString(),
      lowPrice: price.lowPrice.toString(),
      closePrice: price.closePrice.toString(),
      volume: price.volume.toString(),
      source: price.source,
      createdAt: price.createdAt.toISOString()
    };
  }

  private dateOnly(value: string): Date {
    return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  }
}

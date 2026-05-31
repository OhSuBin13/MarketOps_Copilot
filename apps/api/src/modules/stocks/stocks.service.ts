import { Injectable } from "@nestjs/common";

import { DateRangeQueryDto } from "../../common/dto/date-range-query.dto";

const SAMPLE_STOCK_ID = "11111111-1111-4111-8111-111111111111";

@Injectable()
export class StocksService {
  findAll(): Record<string, unknown> {
    const data = [this.buildStock(SAMPLE_STOCK_ID)];

    return {
      data,
      meta: {
        count: data.length,
        source: "week_1_placeholder"
      }
    };
  }

  findOne(id: string): Record<string, unknown> {
    return {
      data: this.buildStock(id),
      meta: {
        source: "week_1_placeholder"
      }
    };
  }

  findPrices(id: string, range: DateRangeQueryDto): Record<string, unknown> {
    return {
      data: [],
      meta: {
        stockId: id,
        from: range.from ?? null,
        to: range.to ?? null,
        source: "week_1_placeholder"
      }
    };
  }

  private buildStock(id: string): Record<string, unknown> {
    return {
      id,
      symbol: "005930",
      name: "Samsung Electronics",
      market: "KOSPI",
      sector: "Semiconductors",
      isActive: true,
      createdAt: "2026-05-30T00:00:00.000Z",
      updatedAt: "2026-05-30T00:00:00.000Z"
    };
  }
}

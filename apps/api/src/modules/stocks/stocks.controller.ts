import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiOkResponse, ApiParam, ApiTags } from "@nestjs/swagger";

import { DateRangeQueryDto } from "../../common/dto/date-range-query.dto";
import { StocksService } from "./stocks.service";

@ApiTags("stocks")
@Controller("stocks")
export class StocksController {
  constructor(private readonly stocksService: StocksService) {}

  @Get()
  @ApiOkResponse({
    description: "List tracked stock master records.",
    schema: {
      example: {
        data: [
          {
            id: "11111111-1111-4111-8111-111111111111",
            symbol: "005930",
            name: "Samsung Electronics",
            market: "KOSPI",
            sector: "Semiconductors",
            isActive: true
          }
        ],
        meta: { count: 1, source: "database" }
      }
    }
  })
  findAll(): Promise<Record<string, unknown>> {
    return this.stocksService.findAll();
  }

  @Get(":id")
  @ApiParam({ name: "id", example: "11111111-1111-4111-8111-111111111111" })
  @ApiOkResponse({
    description: "Get one stock master record.",
    schema: {
      example: {
        data: {
          id: "11111111-1111-4111-8111-111111111111",
          symbol: "005930",
          name: "Samsung Electronics",
          market: "KOSPI",
          sector: "Semiconductors",
          isActive: true
        },
        meta: { source: "database" }
      }
    }
  })
  findOne(@Param("id") id: string): Promise<Record<string, unknown>> {
    return this.stocksService.findOne(id);
  }

  @Get(":id/prices")
  @ApiParam({ name: "id", example: "11111111-1111-4111-8111-111111111111" })
  @ApiOkResponse({
    description: "List daily OHLCV prices for a stock.",
    schema: {
      example: {
        data: [
          {
            id: "22222222-2222-4222-8222-222222222222",
            stockId: "11111111-1111-4111-8111-111111111111",
            tradeDate: "2026-05-30",
            openPrice: "75000",
            highPrice: "76000",
            lowPrice: "74400",
            closePrice: "75500",
            volume: "12500000",
            source: "stooq"
          }
        ],
        meta: {
          stockId: "11111111-1111-4111-8111-111111111111",
          from: "2026-05-01",
          to: "2026-05-30",
          count: 1,
          source: "database"
        }
      }
    }
  })
  findPrices(@Param("id") id: string, @Query() query: DateRangeQueryDto): Promise<Record<string, unknown>> {
    return this.stocksService.findPrices(id, query);
  }
}

import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiOkResponse, ApiParam, ApiTags } from "@nestjs/swagger";

import { MarketEventSeverity, MarketEventType } from "../../common/market.enums";
import { EventsQueryDto } from "./dto/events-query.dto";
import { EventsService } from "./events.service";

@ApiTags("events")
@Controller("events")
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  @ApiOkResponse({
    description: "List detected market events.",
    schema: {
      example: {
        data: [
          {
            id: "22222222-2222-4222-8222-222222222222",
            stockId: "11111111-1111-4111-8111-111111111111",
            eventType: MarketEventType.PRICE_SPIKE,
            severity: MarketEventSeverity.HIGH,
            detectedAt: "2026-05-30T00:00:00.000Z",
            metricValue: 7.3,
            baselineValue: 0.9,
            summary: "Sample price spike event used for the initial API contract.",
            evidenceDocumentIds: [],
            status: "open"
          }
        ],
        meta: {
          count: 1,
          filters: {
            severity: MarketEventSeverity.HIGH,
            type: MarketEventType.PRICE_SPIKE,
            from: "2026-05-01",
            to: "2026-05-30"
          },
          source: "week_1_placeholder"
        }
      }
    }
  })
  findAll(@Query() query: EventsQueryDto): Record<string, unknown> {
    return this.eventsService.findAll(query);
  }

  @Get(":id")
  @ApiParam({ name: "id", example: "22222222-2222-4222-8222-222222222222" })
  @ApiOkResponse({
    description: "Get one detected market event.",
    schema: {
      example: {
        data: {
          id: "22222222-2222-4222-8222-222222222222",
          stockId: "11111111-1111-4111-8111-111111111111",
          eventType: MarketEventType.PRICE_SPIKE,
          severity: MarketEventSeverity.HIGH,
          detectedAt: "2026-05-30T00:00:00.000Z",
          metricValue: 7.3,
          baselineValue: 0.9,
          summary: "Sample price spike event used for the initial API contract.",
          evidenceDocumentIds: [],
          status: "open"
        },
        meta: { source: "week_1_placeholder" }
      }
    }
  })
  findOne(@Param("id") id: string): Record<string, unknown> {
    return this.eventsService.findOne(id);
  }
}

import { Injectable } from "@nestjs/common";

import { MarketEventSeverity, MarketEventType } from "../../common/market.enums";
import { EventsQueryDto } from "./dto/events-query.dto";

const SAMPLE_EVENT_ID = "22222222-2222-4222-8222-222222222222";
const SAMPLE_STOCK_ID = "11111111-1111-4111-8111-111111111111";

@Injectable()
export class EventsService {
  findAll(query: EventsQueryDto): Record<string, unknown> {
    const event = this.buildEvent(SAMPLE_EVENT_ID);
    const data = [event].filter((item) => {
      const typedItem = item as { severity: string; eventType: string };

      if (query.severity && typedItem.severity !== query.severity) {
        return false;
      }

      if (query.type && typedItem.eventType !== query.type) {
        return false;
      }

      return true;
    });

    return {
      data,
      meta: {
        count: data.length,
        filters: {
          severity: query.severity ?? null,
          type: query.type ?? null,
          from: query.from ?? null,
          to: query.to ?? null
        },
        source: "week_1_placeholder"
      }
    };
  }

  findOne(id: string): Record<string, unknown> {
    return {
      data: this.buildEvent(id),
      meta: {
        source: "week_1_placeholder"
      }
    };
  }

  private buildEvent(id: string): Record<string, unknown> {
    return {
      id,
      stockId: SAMPLE_STOCK_ID,
      eventType: MarketEventType.PRICE_SPIKE,
      severity: MarketEventSeverity.HIGH,
      detectedAt: "2026-05-30T00:00:00.000Z",
      metricValue: 7.3,
      baselineValue: 0.9,
      summary: "Sample price spike event used for the initial API contract.",
      evidenceDocumentIds: [],
      status: "open"
    };
  }
}

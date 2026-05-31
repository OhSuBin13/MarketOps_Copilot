import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsEnum, IsOptional } from "class-validator";

import { MarketEventSeverity, MarketEventType } from "../../../common/market.enums";

export class EventsQueryDto {
  @ApiPropertyOptional({ enum: MarketEventSeverity, example: MarketEventSeverity.HIGH })
  @IsOptional()
  @IsEnum(MarketEventSeverity)
  severity?: MarketEventSeverity;

  @ApiPropertyOptional({ enum: MarketEventType, example: MarketEventType.PRICE_SPIKE })
  @IsOptional()
  @IsEnum(MarketEventType)
  type?: MarketEventType;

  @ApiPropertyOptional({ example: "2026-05-01" })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: "2026-05-30" })
  @IsOptional()
  @IsDateString()
  to?: string;
}

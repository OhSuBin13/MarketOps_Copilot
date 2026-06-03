import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsObject, IsOptional } from "class-validator";

import { IngestionJobType } from "../../../common/market.enums";

export class CreateIngestionJobDto {
  @ApiProperty({ enum: IngestionJobType, example: IngestionJobType.STOCK_MASTER })
  @IsEnum(IngestionJobType)
  jobType!: IngestionJobType;

  @ApiPropertyOptional({
    example: {
      stocks: [
        {
          symbol: "005930",
          name: "Samsung Electronics",
          market: "KRX",
          sector: "Semiconductors",
          stooqSymbol: "005930.KR",
          dartCorpCode: "00126380",
          newsQuery: "삼성전자"
        }
      ],
      from: "2026-05-01",
      to: "2026-05-30",
      includeNews: true,
      includeDisclosures: true,
      limit: 20
    }
  })
  @IsOptional()
  @IsObject()
  parameters?: Record<string, unknown>;
}

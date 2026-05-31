import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsObject, IsOptional } from "class-validator";

import { IngestionJobType } from "../../../common/market.enums";

export class CreateIngestionJobDto {
  @ApiProperty({ enum: IngestionJobType, example: IngestionJobType.STOCK_MASTER })
  @IsEnum(IngestionJobType)
  jobType!: IngestionJobType;

  @ApiPropertyOptional({
    example: {
      symbols: ["005930", "000660"]
    }
  })
  @IsOptional()
  @IsObject()
  parameters?: Record<string, unknown>;
}

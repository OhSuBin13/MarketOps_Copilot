import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsOptional } from "class-validator";

export class DateRangeQueryDto {
  @ApiPropertyOptional({ example: "2026-05-01" })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: "2026-05-30" })
  @IsOptional()
  @IsDateString()
  to?: string;
}

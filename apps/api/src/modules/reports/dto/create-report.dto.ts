import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

export class CreateReportDto {
  @ApiProperty({ example: "11111111-1111-4111-8111-111111111111" })
  @IsUUID()
  stockId!: string;

  @ApiPropertyOptional({ example: "22222222-2222-4222-8222-222222222222" })
  @IsOptional()
  @IsUUID()
  eventId?: string;

  @ApiPropertyOptional({
    example: "Summarize the latest market event using stored evidence only."
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  prompt?: string;
}

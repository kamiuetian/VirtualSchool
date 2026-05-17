import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsOptional, Max, Min } from "class-validator";

export class OfflineAlertScanDto {
  @ApiPropertyOptional({
    default: 60,
    maximum: 10080,
    minimum: 5,
  })
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(10080)
  offlineAfterMinutes?: number;
}

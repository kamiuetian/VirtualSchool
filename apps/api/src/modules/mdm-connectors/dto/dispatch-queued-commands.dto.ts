import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsOptional, Max, Min } from "class-validator";

export class DispatchQueuedCommandsDto {
  @ApiPropertyOptional({
    default: 25,
    maximum: 100,
    minimum: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

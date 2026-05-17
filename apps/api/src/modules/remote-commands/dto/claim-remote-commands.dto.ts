import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsOptional, Max, Min } from "class-validator";

export class ClaimRemoteCommandsDto {
  @ApiPropertyOptional({
    default: 10,
    maximum: 50,
    minimum: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}

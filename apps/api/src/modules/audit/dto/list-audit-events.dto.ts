import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";

export class ListAuditEventsDto {
  @ApiPropertyOptional({ maximum: 200, minimum: 1 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  offset?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  action?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  object?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  objectId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  actorId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  outcome?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  to?: string;
}

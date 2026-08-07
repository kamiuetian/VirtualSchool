import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  ValidateIf,
} from "class-validator";

export class CreateCalendarExceptionDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ enum: ["CLOSED", "OVERRIDE"] })
  @IsIn(["CLOSED", "OVERRIDE"])
  kind!: "CLOSED" | "OVERRIDE";

  @ApiProperty({ example: "2026-12-25" })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  localDate!: string;

  @ApiPropertyOptional({ enum: ["TENANT", "GRADE", "CLASS"] })
  @IsOptional()
  @IsIn(["TENANT", "GRADE", "CLASS"])
  scope?: "TENANT" | "GRADE" | "CLASS";

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  scopeId?: string;

  @ApiPropertyOptional()
  @ValidateIf((value: CreateCalendarExceptionDto) => value.kind === "OVERRIDE")
  @IsString()
  @IsNotEmpty()
  policyId?: string;

  @ApiPropertyOptional({ minimum: 0, maximum: 1439 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1439)
  startMinute?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 1440 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1440)
  endMinute?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  actorId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

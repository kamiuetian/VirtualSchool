import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";

const scopes = ["TENANT", "GRADE", "CLASS"] as const;

export class CreateTimetableBlockDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  policyId!: string;

  @ApiProperty({ enum: scopes })
  @IsIn(scopes)
  scope!: (typeof scopes)[number];

  @ApiPropertyOptional({
    description: "Required for grade and class blocks. Omit for tenant blocks.",
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  scopeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  branchId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiProperty({ description: "ISO weekday: Monday=1, Sunday=7" })
  @IsInt()
  @Min(1)
  @Max(7)
  dayOfWeek!: number;

  @ApiProperty({ description: "Minutes after midnight in block timezone" })
  @IsInt()
  @Min(0)
  @Max(1439)
  startMinute!: number;

  @ApiProperty({ description: "Exclusive end minute after midnight" })
  @IsInt()
  @Min(1)
  @Max(1440)
  endMinute!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  effectiveUntil?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  actorId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

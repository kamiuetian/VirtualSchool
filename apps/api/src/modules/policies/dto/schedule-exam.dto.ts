import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsIn, IsNotEmpty, IsOptional, IsString } from "class-validator";

const examScopes = ["GRADE", "CLASS", "STUDENT"] as const;

export class ScheduleExamDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  policyId!: string;

  @ApiProperty({ enum: examScopes })
  @IsIn(examScopes)
  scope!: (typeof examScopes)[number];

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  scopeId!: string;

  @ApiProperty()
  @IsDateString()
  startsAt!: string;

  @ApiProperty()
  @IsDateString()
  endsAt!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

export class CompleteExamDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  reason!: string;
}

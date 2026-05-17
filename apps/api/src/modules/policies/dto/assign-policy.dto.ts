import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
} from "class-validator";

const assignmentScopes = [
  "TENANT",
  "GRADE",
  "CLASS",
  "STUDENT",
  "DEVICE",
] as const;

export class AssignPolicyDto {
  @ApiProperty({ enum: assignmentScopes })
  @IsIn(assignmentScopes)
  scope!: (typeof assignmentScopes)[number];

  @ApiPropertyOptional({
    description:
      "Required for grade, class, student, and device assignments. Omit for tenant baseline.",
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  scopeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  actorId?: string;
}

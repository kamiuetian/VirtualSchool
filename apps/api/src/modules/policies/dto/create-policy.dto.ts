import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
} from "class-validator";

const policyStatuses = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;

export class CreatePolicyDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty()
  @IsObject()
  rules!: Record<string, unknown>;

  @ApiPropertyOptional({ enum: policyStatuses })
  @IsIn(policyStatuses)
  @IsOptional()
  status?: (typeof policyStatuses)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  summary?: string;
}

import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
} from "class-validator";

const approvalStatuses = [
  "APPROVED",
  "PENDING_REVIEW",
  "DEPRECATED",
  "BLOCKED",
] as const;

export class UpdateAppCatalogItemDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ require_tld: false })
  iconUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ type: [String] })
  @ArrayMaxSize(20)
  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  approvedGrades?: string[];

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  installRules?: Record<string, unknown>;

  @ApiPropertyOptional({ enum: approvalStatuses })
  @IsIn(approvalStatuses)
  @IsOptional()
  approvalStatus?: (typeof approvalStatuses)[number];
}

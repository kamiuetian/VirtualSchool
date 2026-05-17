import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
} from "class-validator";

const approvalStatuses = [
  "APPROVED",
  "PENDING_REVIEW",
  "DEPRECATED",
  "BLOCKED",
] as const;

export class CreateAppCatalogItemDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: "com.google.android.apps.classroom" })
  @IsString()
  @Matches(/^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/)
  packageId!: string;

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

import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
} from "class-validator";
import type {
  SupportNoteCategory,
  SupportNoteSeverity,
  SupportNoteStatus,
  SupportNoteVisibility,
} from "@virtual-school/shared";

const categories = [
  "GENERAL",
  "INCIDENT",
  "ESCALATION",
  "DEPLOYMENT",
  "ENROLLMENT",
  "PRIVACY",
] as const satisfies readonly SupportNoteCategory[];

const severities = [
  "S1",
  "S2",
  "S3",
  "S4",
] as const satisfies readonly SupportNoteSeverity[];
const statuses = [
  "OPEN",
  "IN_PROGRESS",
  "RESOLVED",
] as const satisfies readonly SupportNoteStatus[];
const visibilities = [
  "INTERNAL",
  "SCHOOL",
] as const satisfies readonly SupportNoteVisibility[];

export class CreateSupportNoteDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  body!: string;

  @ApiPropertyOptional({ enum: categories })
  @IsIn(categories)
  @IsOptional()
  category?: SupportNoteCategory;

  @ApiPropertyOptional({ enum: severities })
  @IsIn(severities)
  @IsOptional()
  severity?: SupportNoteSeverity;

  @ApiPropertyOptional({ enum: statuses })
  @IsIn(statuses)
  @IsOptional()
  status?: SupportNoteStatus;

  @ApiPropertyOptional({ enum: visibilities })
  @IsIn(visibilities)
  @IsOptional()
  visibility?: SupportNoteVisibility;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  pinned?: boolean;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  resolution?: string;
}

import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsOptional, Max, Min } from "class-validator";

export class UpdateRetentionSettingsDto {
  @ApiPropertyOptional({ maximum: 3650, minimum: 7 })
  @IsInt()
  @Min(7)
  @Max(3650)
  @IsOptional()
  diagnosticRetentionDays?: number;

  @ApiPropertyOptional({ maximum: 3650, minimum: 7 })
  @IsInt()
  @Min(7)
  @Max(3650)
  @IsOptional()
  resolvedAlertRetentionDays?: number;

  @ApiPropertyOptional({ maximum: 3650, minimum: 30 })
  @IsInt()
  @Min(30)
  @Max(3650)
  @IsOptional()
  commandHistoryRetentionDays?: number;

  @ApiPropertyOptional({ maximum: 3650, minimum: 30 })
  @IsInt()
  @Min(30)
  @Max(3650)
  @IsOptional()
  supportNoteRetentionDays?: number;

  @ApiPropertyOptional({ maximum: 3650, minimum: 1 })
  @IsInt()
  @Min(1)
  @Max(3650)
  @IsOptional()
  exportArtifactRetentionDays?: number;

  @ApiPropertyOptional({
    description:
      "Optional audit retention. Omit to retain audit records indefinitely.",
    maximum: 3650,
    minimum: 365,
  })
  @IsInt()
  @Min(365)
  @Max(3650)
  @IsOptional()
  auditRetentionDays?: number;
}

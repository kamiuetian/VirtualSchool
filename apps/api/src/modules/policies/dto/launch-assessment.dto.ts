import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString, MinLength } from "class-validator";

export class LaunchAssessmentDto {
  @ApiProperty({ enum: ["APP", "URL"] })
  @IsIn(["APP", "URL"])
  resourceType!: "APP" | "URL";

  @ApiProperty({ description: "Approved package ID or exam web-shortcut URL" })
  @IsString()
  @MinLength(1)
  resource!: string;

  @ApiPropertyOptional({ description: "Operational reason recorded in the audit trail" })
  @IsOptional()
  @IsString()
  reason?: string;
}

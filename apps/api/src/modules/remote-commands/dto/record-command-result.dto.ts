import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsObject, IsOptional, IsString } from "class-validator";

export class RecordCommandResultDto {
  @ApiProperty({ enum: ["EXECUTED", "FAILED"] })
  @IsIn(["EXECUTED", "FAILED"])
  status!: "EXECUTED" | "FAILED";

  @ApiPropertyOptional({
    description: "Connector command id from Android Management API or adapter",
  })
  @IsOptional()
  @IsString()
  connectorCommandId?: string;

  @ApiPropertyOptional({
    description: "Privacy-safe command result metadata",
    type: Object,
  })
  @IsOptional()
  @IsObject()
  result?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: "Failure detail for failed command execution",
  })
  @IsOptional()
  @IsString()
  failureReason?: string;
}

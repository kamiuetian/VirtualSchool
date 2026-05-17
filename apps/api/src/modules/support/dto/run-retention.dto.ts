import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class RunRetentionDto {
  @ApiPropertyOptional({
    description: "Operational reason captured in the audit trail",
  })
  @IsOptional()
  @IsString()
  reason?: string;
}

import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsOptional, IsString } from "class-validator";

export class SetUserMfaDto {
  @ApiPropertyOptional()
  @IsBoolean()
  mfaEnabled!: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

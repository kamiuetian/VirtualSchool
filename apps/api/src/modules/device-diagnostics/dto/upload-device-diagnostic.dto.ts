import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsDateString,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";

export class UploadDeviceDiagnosticDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  batteryLevel?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  storageFreeMb?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  networkStatus?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  launcherVersion?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  browserVersion?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  mdmPolicyName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  policyVersion?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  health?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  compliance?: string;

  @ApiPropertyOptional({
    description:
      "Privacy-limited technical diagnostics. Do not include browsing history, private messages, audio, camera, screenshots, or keystrokes.",
  })
  @IsOptional()
  @IsObject()
  details?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  reportedAt?: string;
}

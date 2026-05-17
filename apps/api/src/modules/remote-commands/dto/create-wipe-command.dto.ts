import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";

export class CreateWipeCommandDto {
  @ApiProperty({
    description: "Required reason for destructive wipe/reset action",
  })
  @IsString()
  reason!: string;

  @ApiProperty({
    description: "Must exactly match the device serial number",
  })
  @IsString()
  confirmationSerialNumber!: string;

  @ApiPropertyOptional({
    default: false,
    description: "Whether the reset should preserve factory reset protection",
  })
  @IsOptional()
  @IsBoolean()
  preserveFactoryResetProtection?: boolean;

  @ApiPropertyOptional({
    default: 60,
    description: "Minutes before an undelivered wipe command expires",
    maximum: 1440,
    minimum: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1440)
  ttlMinutes?: number;
}

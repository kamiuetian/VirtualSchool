import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsIn, IsInt, IsOptional, IsString, Max, Min, MinLength } from "class-validator";

const integrityTypes = ["APP_EXIT_ATTEMPT", "NETWORK_LOSS", "POLICY_TAMPER", "SCREEN_PINNING_EXIT", "UNEXPECTED_RESTART"] as const;

export class IngestExamIntegrityEventDto {
  @ApiProperty() @IsString() @MinLength(1) deviceId!: string;
  @ApiProperty({ enum: integrityTypes }) @IsIn(integrityTypes) type!: (typeof integrityTypes)[number];
  @ApiPropertyOptional() @IsOptional() @IsDateString() occurredAt?: string;
}

export class UnlockExamDeviceDto {
  @ApiProperty() @IsString() @MinLength(1) deviceId!: string;
  @ApiProperty({ minimum: 1, maximum: 15 }) @IsInt() @Min(1) @Max(15) durationMinutes!: number;
  @ApiProperty() @IsString() @MinLength(3) reason!: string;
}

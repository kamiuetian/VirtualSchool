import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  Max,
  Min,
} from "class-validator";

export class UpdateNotificationPreferenceDto {
  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @ArrayMaxSize(25)
  @IsEmail({}, { each: true })
  @IsOptional()
  recipients?: string[];

  @IsBoolean() @IsOptional() offlineEnabled?: boolean;
  @IsInt() @Min(5) @Max(10080) @IsOptional() offlineAfterMinutes?: number;
  @IsBoolean() @IsOptional() policyFailureEnabled?: boolean;
  @IsBoolean() @IsOptional() appFailureEnabled?: boolean;
  @IsBoolean() @IsOptional() lostDeviceEnabled?: boolean;
  @IsBoolean() @IsOptional() repeatedEnrollmentEnabled?: boolean;
  @IsInt() @Min(2) @Max(100) @IsOptional() repeatedEnrollmentThreshold?: number;
  @IsInt()
  @Min(5)
  @Max(10080)
  @IsOptional()
  deduplicationWindowMinutes?: number;
  @IsBoolean() @IsOptional() engagementRiskEnabled?: boolean;
  @IsInt() @Min(2) @Max(20) @IsOptional() missedSessionThreshold?: number;
  @IsInt() @Min(2) @Max(20) @IsOptional() complianceFailureThreshold?: number;
  @IsBoolean() @IsOptional() weeklyAdminSummaryEnabled?: boolean;
  @IsBoolean() @IsOptional() weeklyGuardianSummaryEnabled?: boolean;
}

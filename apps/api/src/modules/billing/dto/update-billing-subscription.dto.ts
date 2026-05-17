import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsEmail,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";

const billingStatuses = [
  "TRIALING",
  "ACTIVE",
  "PAST_DUE",
  "SUSPENDED",
  "CANCELED",
] as const;

export class UpdateBillingSubscriptionDto {
  @ApiPropertyOptional({ example: "starter" })
  @IsString()
  @MaxLength(64)
  @IsOptional()
  planKey?: string;

  @ApiPropertyOptional({ enum: billingStatuses })
  @IsIn(billingStatuses)
  @IsOptional()
  status?: (typeof billingStatuses)[number];

  @ApiPropertyOptional({ example: "billing@example.edu" })
  @IsEmail()
  @IsOptional()
  billingEmail?: string;

  @ApiPropertyOptional()
  @IsISO8601()
  @IsOptional()
  billingPeriodStart?: string;

  @ApiPropertyOptional()
  @IsISO8601()
  @IsOptional()
  billingPeriodEnd?: string;

  @ApiPropertyOptional()
  @IsISO8601()
  @IsOptional()
  trialEndsAt?: string;

  @ApiPropertyOptional({ minimum: 1 })
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  @IsOptional()
  deviceLimit?: number;

  @ApiPropertyOptional({ minimum: 1 })
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  @IsOptional()
  studentLimit?: number;

  @ApiPropertyOptional({ minimum: 1 })
  @IsInt()
  @Min(1)
  @Max(100_000)
  @IsOptional()
  staffLimit?: number;

  @ApiPropertyOptional({ minimum: 1 })
  @IsInt()
  @Min(1)
  @Max(10_000)
  @IsOptional()
  branchLimit?: number;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsString()
  @MaxLength(1000)
  @IsOptional()
  notes?: string;
}

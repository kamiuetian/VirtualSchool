import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";

export class ProvisionResellerTenantDto {
  @IsString() name!: string;
  @IsString() country!: string;
  @IsString() timezone!: string;
  @IsString() planKey!: string;
  @IsOptional() @IsString() domain?: string;
  @IsOptional() @IsString() externalRef?: string;
  @IsOptional() @IsDateString() renewalAt?: string;
  @IsBoolean() approved!: boolean;
}

export class UpdateResellerCustomerDto {
  @IsOptional()
  @IsIn(["PROVISIONED", "CONFIGURING", "READY", "LIVE", "ON_HOLD"])
  onboardingState?: string;
  @IsOptional() @IsDateString() renewalAt?: string;
}

export class CreateResellerPartnerDto {
  @IsString() name!: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(10000) maxCustomers!: number;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsString({ each: true })
  operatorIds!: string[];
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsString({ each: true })
  allowedPlanKeys!: string[];
  @IsOptional() @IsBoolean() approvalRequired?: boolean;
}

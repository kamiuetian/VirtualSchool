import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsEmail,
  IsOptional,
  IsString,
  ValidateNested,
  Matches,
  Max,
  Min,
} from "class-validator";

export class ImplementationMilestoneDto {
  @IsString() id!: string;
  @IsString() title!: string;
  @IsString() ownerId!: string;
  @IsIn(["NOT_STARTED", "IN_PROGRESS", "BLOCKED", "COMPLETE"])
  status!: string;
  @IsDateString() dueAt!: string;
  @IsOptional() @IsBoolean() readinessGate?: boolean;
  @IsOptional() @IsArray() @IsString({ each: true }) evidenceIds?: string[];
}

export class ImplementationRiskDto {
  @IsString() id!: string;
  @IsString() title!: string;
  @IsString() ownerId!: string;
  @IsIn(["LOW", "MEDIUM", "HIGH", "CRITICAL"]) severity!: string;
  @IsIn(["OPEN", "MITIGATED", "ACCEPTED", "CLOSED"]) status!: string;
  @IsString() mitigation!: string;
}

export class ImplementationEvidenceDto {
  @IsString() id!: string;
  @IsString() title!: string;
  @Matches(/^https:\/\//i, { message: "evidence URL must use HTTPS" })
  url!: string;
}

export class ImplementationDecisionDto {
  @IsString() id!: string;
  @IsString() title!: string;
  @IsIn(["PENDING", "APPROVED", "REJECTED", "SUPERSEDED"])
  status!: string;
  @IsString() ownerId!: string;
  @IsOptional() @IsString() rationale?: string;
}

export class SaveImplementationProjectDto {
  @IsString() name!: string;
  @IsIn(["PLANNING", "DELIVERY", "READY", "LIVE", "ON_HOLD", "CLOSED"])
  status!: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsString({ each: true })
  ownerIds!: string[];
  @IsOptional() @IsDateString() targetGoLiveAt?: string;
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ImplementationMilestoneDto)
  milestones!: ImplementationMilestoneDto[];
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ImplementationRiskDto)
  risks!: ImplementationRiskDto[];
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ImplementationEvidenceDto)
  evidence!: ImplementationEvidenceDto[];
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ImplementationDecisionDto)
  decisions!: ImplementationDecisionDto[];
  @IsString() reason!: string;
}

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

export class UpdateResellerBrandingDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsString({ each: true })
  approvedDomains!: string[];

  @IsOptional()
  @IsString()
  @Matches(/^https:\/\//i, { message: "logoUrl must use HTTPS" })
  logoUrl?: string;

  @IsOptional()
  @Matches(/^#[0-9a-f]{6}$/i)
  primaryColor?: string;

  @IsOptional()
  @Matches(/^#[0-9a-f]{6}$/i)
  accentColor?: string;

  @IsOptional() @IsString() emailSenderName?: string;
  @IsOptional() @IsEmail() emailSenderEmail?: string;
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

import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

export class PublishPrivacyNoticeDto {
  @IsString() @Length(2, 80) noticeType!: string;
  @IsIn(["WEB", "MOBILE", "EMAIL"]) channel!: "WEB" | "MOBILE" | "EMAIL";
  @IsString() @Length(2, 160) title!: string;
  @IsString() @Length(20, 50000) content!: string;
}

export class AcceptPrivacyNoticeDto {
  @IsIn(["WEB", "MOBILE", "EMAIL"]) channel!: "WEB" | "MOBILE" | "EMAIL";
}

export class RevokePrivacyAcceptanceDto {
  @IsString() @IsNotEmpty() @MaxLength(500) reason!: string;
}

class PolicyDocumentDto {
  @IsString() @Length(2, 120) title!: string;
  @IsString() @Length(8, 2048) url!: string;
}

export class UpdateSecurityPrivacyProfileDto {
  @IsString() @Length(2, 120) incidentContactName!: string;
  @IsEmail() @MaxLength(320) incidentContactEmail!: string;
  @IsOptional() @IsString() @MaxLength(40) incidentContactPhone?: string;
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => PolicyDocumentDto)
  policyDocuments!: PolicyDocumentDto[];
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @Length(5, 240, { each: true })
  childSafetyGuardrails!: string[];
}

export class CreateComplianceEvidencePackDto {
  @IsString() @Length(3, 120) name!: string;
  @IsDateString() windowFrom!: string;
  @IsDateString() windowTo!: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @IsIn(["AUDIT_LOGS", "ACCESS_REVIEWS", "RETENTION", "CONTROLS", "POLICIES"], {
    each: true,
  })
  sections!: (
    | "AUDIT_LOGS"
    | "ACCESS_REVIEWS"
    | "RETENTION"
    | "CONTROLS"
    | "POLICIES"
  )[];
}

export class CreateDataSubjectRequestDto {
  @IsIn(["EXPORT", "DELETE"]) requestType!: "EXPORT" | "DELETE";
  @IsIn(["STUDENT", "GUARDIAN", "USER"]) subjectType!:
    | "STUDENT"
    | "GUARDIAN"
    | "USER";
  @IsString() @Length(1, 120) subjectId!: string;
  @IsString() @Length(10, 500) reason!: string;
  @IsOptional() @IsDateString() retentionUntil?: string;
}

export class DecideDataSubjectRequestDto {
  @IsIn(["APPROVE", "REJECT"]) decision!: "APPROVE" | "REJECT";
  @IsString() @Length(5, 500) reason!: string;
}

export class CreateDataLegalHoldDto {
  @IsIn(["STUDENT", "GUARDIAN", "USER"]) subjectType!:
    | "STUDENT"
    | "GUARDIAN"
    | "USER";
  @IsString() @Length(1, 120) subjectId!: string;
  @IsString() @Length(10, 500) reason!: string;
}

export class ReleaseDataLegalHoldDto {
  @IsString() @Length(10, 500) reason!: string;
}

export class CreateSecurityIncidentDto {
  @IsString() @Length(5, 160) title!: string;
  @IsIn([
    "CONFIDENTIALITY",
    "INTEGRITY",
    "AVAILABILITY",
    "PRIVACY",
    "CHILD_SAFETY",
    "OTHER",
  ])
  classification!: string;
  @IsIn(["LOW", "MEDIUM", "HIGH", "CRITICAL"]) severity!: string;
  @IsString() @Length(20, 5000) description!: string;
  @IsString() @Length(1, 120) ownerId!: string;
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @Length(8, 2048, { each: true })
  evidence!: string[];
}

export class AddSecurityIncidentUpdateDto {
  @IsIn([
    "INVESTIGATION",
    "CONTAINMENT",
    "RECOVERY",
    "CUSTOMER_COMMUNICATION",
    "EVIDENCE",
  ])
  updateType!: string;
  @IsString() @Length(10, 2000) summary!: string;
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @Length(8, 2048, { each: true })
  evidence!: string[];
}

export class CloseSecurityIncidentDto {
  @IsString() @Length(20, 2000) closureSummary!: string;
}

export class PublishServiceIncidentDto {
  @IsString() @Length(5, 160) title!: string;
  @IsIn(["INVESTIGATING", "IDENTIFIED", "MONITORING", "RESOLVED"])
  status!: string;
  @IsIn(["MINOR", "MAJOR", "CRITICAL"]) severity!: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @Length(2, 80, { each: true })
  affectedModules!: string[];
  @IsString() @Length(20, 2000) summary!: string;
  @IsDateString() startedAt!: string;
  @IsOptional() @IsDateString() resolvedAt?: string;
}

export class PublishMaintenanceWindowDto {
  @IsString() @Length(5, 160) title!: string;
  @IsIn(["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELED"])
  status!: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @Length(2, 80, { each: true })
  affectedModules!: string[];
  @IsString() @Length(20, 2000) summary!: string;
  @IsDateString() startsAt!: string;
  @IsDateString() endsAt!: string;
}

export class PublishDisasterRecoveryEvidenceDto {
  @IsString() @Length(5, 160) title!: string;
  @IsInt() @Min(0) rpoMinutes!: number;
  @IsInt() @Min(0) rtoMinutes!: number;
  @IsDateString() exerciseDate!: string;
  @IsIn(["PASSED", "PASSED_WITH_ACTIONS", "FAILED"]) outcome!: string;
  @IsString() @Length(8, 2048) evidenceUrl!: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @Length(1, 80, { each: true })
  eligiblePlans!: string[];
}

export class RecordBackupVerificationDto {
  @IsIn(["DATABASE", "OBJECT_STORAGE", "CONFIGURATION"])
  backupType!: string;
  @IsString() @Length(2, 80) provider!: string;
  @IsString() @Length(3, 160) backupReference!: string;
  @IsIn(["VERIFIED", "FAILED", "MISSING"]) status!: string;
  @IsDateString() backupCreatedAt!: string;
  @IsDateString() verifiedAt!: string;
  @IsInt() @Min(1) expectedIntervalHours!: number;
  @IsOptional() @IsDateString() retentionUntil?: string;
  @IsString() @Length(8, 2048) evidenceUrl!: string;
  @IsOptional() @IsString() @Length(10, 1000) notes?: string;
}

export class RequestRestoreDrillDto {
  @IsString() @Length(1, 120) backupVerificationId!: string;
  @IsString() @Length(5, 160) title!: string;
  @IsIn(["ISOLATED_TEST", "STAGING"]) environment!: string;
  @IsString() @Length(8, 2048) runbookUrl!: string;
  @IsString() @Length(20, 1000) reason!: string;
}

export class ApproveRestoreDrillDto {
  @IsString() @Length(10, 1000) approvalNote!: string;
}

export class CompleteRestoreDrillDto {
  @IsIn(["PASSED", "PASSED_WITH_ACTIONS", "FAILED"]) outcome!: string;
  @IsString() @Length(20, 2000) resultSummary!: string;
  @IsString() @Length(8, 2048) evidenceUrl!: string;
}

export class DecidePolicyRecommendationDto {
  @IsIn(["APPROVE", "REJECT"]) decision!: "APPROVE" | "REJECT";
  @IsString() @Length(10, 1000) reason!: string;
}

export class UpdateSecurityAnomalyDto {
  @IsIn(["ACKNOWLEDGE", "RESOLVE"]) action!: "ACKNOWLEDGE" | "RESOLVE";
  @IsString() @Length(10, 1000) reason!: string;
}

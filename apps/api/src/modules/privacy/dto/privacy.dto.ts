import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  MaxLength,
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

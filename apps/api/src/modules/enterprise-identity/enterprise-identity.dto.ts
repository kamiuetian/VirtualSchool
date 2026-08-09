import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  Length,
  MaxLength,
} from "class-validator";
import type { StaffRole } from "@virtual-school/shared";

const roles = [
  "SCHOOL_ADMIN",
  "IT_ADMIN",
  "ACADEMIC_ADMIN",
  "TEACHER",
  "SUPPORT_AGENT",
  "BILLING_ADMIN",
  "AUDITOR",
] as const satisfies readonly StaffRole[];
export class ConfigureEnterpriseIdentityDto {
  @IsIn(["SAML", "OIDC"]) protocol!: "SAML" | "OIDC";
  @IsUrl({ require_protocol: true, protocols: ["https"] }) issuer!: string;
  @IsOptional() @IsString() @Length(1, 160) clientId?: string;
  @IsOptional()
  @IsUrl({ require_protocol: true, protocols: ["https"] })
  metadataUrl?: string;
  @IsString() @Length(3, 240) credentialReference!: string;
  @IsString() @Length(3, 240) scimTokenReference!: string;
  @IsUUID() breakGlassUserId!: string;
}
export class MapScimGroupDto {
  @IsString() @Length(1, 160) externalGroup!: string;
  @IsIn(roles) role!: StaffRole;
  @IsOptional() @IsUUID() branchId?: string;
}
export class ScimUserDto {
  @IsString() @Length(1, 160) externalId!: string;
  @IsEmail() email!: string;
  @IsString() @Length(1, 160) name!: string;
  @IsArray() @IsString({ each: true }) groups!: string[];
  @IsOptional() @IsBoolean() active?: boolean;
}
export class ScimLifecycleDto extends ScimUserDto {
  @IsIn(["CREATE", "UPDATE", "SUSPEND", "DELETE"]) operation!:
    | "CREATE"
    | "UPDATE"
    | "SUSPEND"
    | "DELETE";
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}

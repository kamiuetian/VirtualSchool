import { Type } from "class-transformer";
import { IsArray, IsEmail, IsIn, IsOptional, IsString, IsUUID, Length, MaxLength, ValidateNested } from "class-validator";

export class AuthorizeGoogleWorkspaceDto {
  @IsString() @Length(1, 128) customerId!: string;
  @IsEmail() delegatedAdminEmail!: string;
  @IsString() @Length(3, 240) credentialReference!: string;
}
export class MapGoogleWorkspaceOuDto {
  @IsString() @Length(1, 128) organizationalUnitId!: string;
  @IsString() @Length(1, 500) organizationalUnitPath!: string;
  @IsOptional() @IsUUID() branchId?: string;
}
const capabilityStatuses = ["SUPPORTED", "PARTIAL", "UNSUPPORTED", "UNKNOWN"] as const;
export class ChromeOsInventoryItemDto {
  @IsString() @Length(1, 128) externalDeviceId!: string;
  @IsString() @Length(1, 128) organizationalUnitId!: string;
  @IsString() @Length(1, 128) serialNumber!: string;
  @IsOptional() @IsString() @MaxLength(120) model?: string;
  @IsOptional() @IsString() @MaxLength(40) osVersion?: string;
  @IsOptional() @IsString() @MaxLength(40) health?: string;
  @IsIn(capabilityStatuses) kioskStatus!: (typeof capabilityStatuses)[number];
  @IsIn(capabilityStatuses) managedSessionStatus!: (typeof capabilityStatuses)[number];
  @IsIn(capabilityStatuses) appExtensionStatus!: (typeof capabilityStatuses)[number];
  @IsIn(capabilityStatuses) webPolicyStatus!: (typeof capabilityStatuses)[number];
}
export class IngestChromeOsInventoryDto {
  @IsArray() @ValidateNested({ each: true }) @Type(() => ChromeOsInventoryItemDto)
  devices!: ChromeOsInventoryItemDto[];
}

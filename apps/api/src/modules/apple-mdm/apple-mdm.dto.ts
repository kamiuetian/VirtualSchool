import { Type } from "class-transformer";
import {
  IsArray,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  MaxLength,
  ValidateNested,
} from "class-validator";

export class ConfigureAppleMdmDto {
  @IsString() @Length(1, 120) providerName!: string;
  @IsUrl({ protocols: ["https"], require_protocol: true }) serverUrl!: string;
  @IsString() @Length(3, 240) credentialReference!: string;
  @IsString() @Length(1, 128) appleSchoolManagerId!: string;
  @IsISO8601() tokenExpiresAt!: string;
  @IsISO8601() certificateExpiresAt!: string;
}
const statuses = ["SUPPORTED", "PARTIAL", "UNSUPPORTED", "UNKNOWN"] as const;
export class AppleInventoryItemDto {
  @IsString() @Length(1, 128) externalDeviceId!: string;
  @IsString() @Length(1, 128) serialNumber!: string;
  @IsOptional() @IsString() @MaxLength(120) model?: string;
  @IsOptional() @IsString() @MaxLength(40) osVersion?: string;
  @IsOptional() @IsString() @MaxLength(40) health?: string;
  @IsIn(statuses) adeStatus!: (typeof statuses)[number];
  @IsIn(statuses) supervisionStatus!: (typeof statuses)[number];
  @IsIn(statuses) restrictionStatus!: (typeof statuses)[number];
  @IsIn(statuses) appBookStatus!: (typeof statuses)[number];
  @IsIn(statuses) managedConfigurationStatus!: (typeof statuses)[number];
}
export class IngestAppleInventoryDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AppleInventoryItemDto)
  devices!: AppleInventoryItemDto[];
}

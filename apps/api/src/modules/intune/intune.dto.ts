import { Type } from "class-transformer";
import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  ValidateNested,
} from "class-validator";

export class AuthorizeIntuneDto {
  @IsUUID() entraTenantId!: string;
  @IsUUID() clientId!: string;
  @IsString() @Length(3, 240) credentialReference!: string;
}
export class MapIntuneGroupDto {
  @IsString() @Length(1, 128) groupId!: string;
  @IsString() @Length(1, 160) groupName!: string;
  @IsOptional() @IsUUID() branchId?: string;
}
const statuses = ["SUPPORTED", "PARTIAL", "UNSUPPORTED", "UNKNOWN"] as const;
export class IntuneInventoryItemDto {
  @IsString() @Length(1, 128) externalDeviceId!: string;
  @IsString() @Length(1, 128) groupId!: string;
  @IsString() @Length(1, 128) serialNumber!: string;
  @IsOptional() @IsString() @MaxLength(120) model?: string;
  @IsOptional() @IsString() @MaxLength(40) osVersion?: string;
  @IsIn(statuses) kioskStatus!: (typeof statuses)[number];
  @IsIn(statuses) assessmentStatus!: (typeof statuses)[number];
  @IsIn(statuses) autopilotStatus!: (typeof statuses)[number];
  @IsIn(statuses) appDeploymentStatus!: (typeof statuses)[number];
  @IsIn(statuses) managementHealthStatus!: (typeof statuses)[number];
}
export class IngestIntuneInventoryDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IntuneInventoryItemDto)
  devices!: IntuneInventoryItemDto[];
}

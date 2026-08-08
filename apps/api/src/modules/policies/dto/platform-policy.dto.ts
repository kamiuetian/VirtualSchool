import { ApiProperty } from "@nestjs/swagger";
import {
  businessPolicyControls,
  devicePlatforms,
} from "@virtual-school/shared";
import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsString,
  ValidateNested,
} from "class-validator";

const enrollmentTypes = [
  "FULLY_MANAGED",
  "SUPERVISED",
  "USER_ENROLLED",
  "BYOD_SESSION",
  "UNKNOWN",
] as const;
const ownershipTypes = ["SCHOOL_OWNED", "PERSONAL", "CORPORATE"] as const;

export class PlatformControlOverrideDto {
  @ApiProperty({ enum: businessPolicyControls })
  @IsIn(businessPolicyControls)
  control!: (typeof businessPolicyControls)[number];

  @ApiProperty()
  @IsBoolean()
  enabled!: boolean;
}

export class UpdatePlatformOverridesDto {
  @ApiProperty({ enum: devicePlatforms })
  @IsIn(devicePlatforms)
  platform!: (typeof devicePlatforms)[number];

  @ApiProperty({ type: [PlatformControlOverrideDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlatformControlOverrideDto)
  overrides!: PlatformControlOverrideDto[];
}

export class SimulatePlatformPolicyDto {
  @ApiProperty({ enum: devicePlatforms })
  @IsIn(devicePlatforms)
  platform!: (typeof devicePlatforms)[number];

  @ApiProperty({ enum: enrollmentTypes })
  @IsIn(enrollmentTypes)
  enrollmentType!: (typeof enrollmentTypes)[number];

  @ApiProperty({ enum: ownershipTypes })
  @IsIn(ownershipTypes)
  ownershipType!: (typeof ownershipTypes)[number];

  @ApiProperty({ required: false })
  @IsString()
  osVersion?: string;
}

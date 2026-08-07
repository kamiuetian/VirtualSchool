import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from "class-validator";

const updateTypes = ["AUTOMATIC", "POSTPONE", "WINDOWED"] as const;
const navigationModes = [
  "NAVIGATION_DISABLED",
  "HOME_BUTTON_ONLY",
  "NAVIGATION_ENABLED",
] as const;
const statusBarModes = [
  "NOTIFICATIONS_AND_SYSTEM_INFO_DISABLED",
  "SYSTEM_INFO_ONLY",
  "NOTIFICATIONS_AND_SYSTEM_INFO_ENABLED",
] as const;
const powerButtonModes = [
  "POWER_BUTTON_BLOCKED",
  "POWER_BUTTON_AVAILABLE",
] as const;

class SystemUpdateControlDto {
  @ApiProperty({ enum: updateTypes })
  @IsIn(updateTypes)
  type!: (typeof updateTypes)[number];

  @ApiPropertyOptional({ maximum: 1439, minimum: 0 })
  @ValidateIf((value: SystemUpdateControlDto) => value.type === "WINDOWED")
  @IsInt()
  @Min(0)
  @Max(1439)
  startMinutes?: number;

  @ApiPropertyOptional({ maximum: 1439, minimum: 0 })
  @ValidateIf((value: SystemUpdateControlDto) => value.type === "WINDOWED")
  @IsInt()
  @Min(0)
  @Max(1439)
  endMinutes?: number;
}

class KioskCustomizationDto {
  @ApiProperty({ enum: navigationModes })
  @IsIn(navigationModes)
  systemNavigation!: (typeof navigationModes)[number];

  @ApiProperty({ enum: statusBarModes })
  @IsIn(statusBarModes)
  statusBar!: (typeof statusBarModes)[number];

  @ApiProperty({ enum: powerButtonModes })
  @IsIn(powerButtonModes)
  powerButtonActions!: (typeof powerButtonModes)[number];
}

export class UpdateAndroidControlsDto {
  @ApiProperty()
  @IsBoolean()
  blockFactoryReset!: boolean;

  @ApiProperty()
  @ValidateNested()
  @Type(() => SystemUpdateControlDto)
  systemUpdate!: SystemUpdateControlDto;

  @ApiProperty()
  @ValidateNested()
  @Type(() => KioskCustomizationDto)
  kioskCustomization!: KioskCustomizationDto;
}

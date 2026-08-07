import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  IsIn,
} from "class-validator";

export class ReportLostDeviceDto {
  @ApiProperty({ maxLength: 500 })
  @IsString()
  @MaxLength(500)
  reason!: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  startLostWorkflow?: boolean;
}

export class UpdateGuardianNotificationsDto {
  @ApiProperty({ type: [String], enum: ["EMAIL", "SMS", "IN_APP"] })
  @IsArray()
  @ArrayUnique()
  @IsIn(["EMAIL", "SMS", "IN_APP"], { each: true })
  channels!: string[];
}

export class CreateGuardianSupportRequestDto {
  @ApiProperty({ enum: ["DEVICE", "CONNECTIVITY", "ACCESS", "OTHER"] })
  @IsIn(["DEVICE", "CONNECTIVITY", "ACCESS", "OTHER"])
  category!: string;

  @ApiProperty({ maxLength: 120 })
  @IsString()
  @MaxLength(120)
  subject!: string;

  @ApiProperty({ maxLength: 1000 })
  @IsString()
  @MaxLength(1000)
  description!: string;
}

export class UpdateAfterSchoolControlDto {
  @ApiProperty()
  @IsBoolean()
  enabled!: boolean;

  @ApiProperty({ minimum: 15, maximum: 240 })
  @IsInt()
  @Min(15)
  @Max(240)
  dailyLimitMinutes!: number;

  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  allowedAppIds!: string[];
}

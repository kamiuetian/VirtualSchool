import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  ArrayMaxSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
} from "class-validator";

export class DeviceCheckInDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  enrollmentToken!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  serialNumber!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  enrollmentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  manufacturer?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  model?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  androidVersion?: string;

  @ApiPropertyOptional({ type: [String] })
  @ArrayMaxSize(20)
  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  tags?: string[];
}

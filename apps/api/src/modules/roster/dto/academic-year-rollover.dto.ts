import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  ArrayUnique,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
} from "class-validator";

export class AcademicYearRolloverDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  sourceAcademicYear!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  targetAcademicYear!: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  classIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  actorId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

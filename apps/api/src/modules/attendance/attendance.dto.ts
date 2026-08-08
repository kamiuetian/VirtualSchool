import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

export class UpdateAttendanceSettingsDto {
  @IsOptional() @IsBoolean() sessionSignalEnabled?: boolean;
  @IsOptional() @IsBoolean() deviceSignalEnabled?: boolean;
  @IsOptional() @IsBoolean() lmsSignalEnabled?: boolean;
  @IsOptional() @IsBoolean() teacherSignalEnabled?: boolean;
  @IsOptional() @IsInt() @Min(1) @Max(4) presentThreshold?: number;
}

export class CaptureAttendanceDto {
  @IsUUID() classId!: string;
  @IsDateString() attendanceDate!: string;
}

export class CorrectAttendanceDto {
  @IsIn(["PRESENT", "ABSENT", "LATE", "EXCUSED"]) status!: string;
  @IsString() @MinLength(3) @MaxLength(500) reason!: string;
}

import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Length,
  Max,
  Min,
} from "class-validator";

export class AssignTeacherClassDto {
  @IsUUID()
  teacherId!: string;
}

export class StartTeacherSessionDto {
  @IsUUID()
  classId!: string;
}

export class CreateTeacherSessionTemplateDto {
  @IsString() @Length(3, 80) name!: string;
  @IsUUID() classId!: string;
  @IsOptional() @IsUUID() resourceId?: string;
  @IsOptional() @IsString() @Length(1, 500) focusMessage?: string;
  @IsOptional() @IsInt() @Min(1) @Max(10) focusDurationMinutes?: number;
  @IsOptional()
  @IsUrl({
    protocols: ["http", "https"],
    require_protocol: true,
    require_tld: false,
  })
  @Length(1, 2048)
  temporaryUrl?: string;
  @IsOptional() @IsInt() @Min(1) @Max(60) temporaryUrlMinutes?: number;
}

export class EndTeacherSessionDto {
  @IsString()
  @Length(3, 240)
  reason!: string;
}

export class RecordTeacherDeviceEventDto {
  @IsUUID()
  deviceId!: string;

  @IsIn([
    "DEVICE_OFFLINE",
    "DEVICE_ONLINE",
    "COMPLIANCE_CHANGED",
    "DEVICE_LEFT_CLASS",
  ])
  type!: string;
}

export class PushTeacherResourceDto {
  @IsUUID()
  resourceId!: string;
}

export class PushEducationResourceDto {
  @IsUUID()
  resourceId!: string;
}

export class ShowFocusScreenDto {
  @IsString()
  @Length(1, 500)
  message!: string;

  @IsInt()
  @Min(1)
  @Max(10)
  durationMinutes!: number;
}

export class ApproveTemporaryUrlDto {
  @IsUrl({
    protocols: ["http", "https"],
    require_protocol: true,
    require_tld: false,
  })
  @Length(1, 2048)
  url!: string;

  @IsInt()
  @Min(1)
  @Max(60)
  durationMinutes!: number;
}

import { IsIn, IsInt, IsString, IsUrl, IsUUID, Length, Max, Min } from "class-validator";

export class AssignTeacherClassDto {
  @IsUUID()
  teacherId!: string;
}

export class StartTeacherSessionDto {
  @IsUUID()
  classId!: string;
}

export class EndTeacherSessionDto {
  @IsString()
  @Length(3, 240)
  reason!: string;
}

export class RecordTeacherDeviceEventDto {
  @IsUUID()
  deviceId!: string;

  @IsIn(["DEVICE_OFFLINE", "DEVICE_ONLINE", "COMPLIANCE_CHANGED", "DEVICE_LEFT_CLASS"])
  type!: string;
}

export class PushTeacherResourceDto {
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
  @IsUrl({ protocols: ["http", "https"], require_protocol: true, require_tld: false })
  @Length(1, 2048)
  url!: string;

  @IsInt()
  @Min(1)
  @Max(60)
  durationMinutes!: number;
}

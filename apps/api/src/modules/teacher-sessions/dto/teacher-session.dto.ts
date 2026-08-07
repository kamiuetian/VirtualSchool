import { IsIn, IsString, IsUUID, Length } from "class-validator";

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

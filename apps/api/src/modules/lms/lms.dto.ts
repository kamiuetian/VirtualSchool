import {
  IsIn,
  IsString,
  IsUUID,
  IsUrl,
  Length,
  MaxLength,
} from "class-validator";
export class ConfigureLmsDto {
  @IsIn(["MOODLE", "CANVAS"]) provider!: "MOODLE" | "CANVAS";
  @IsUrl({ protocols: ["https"], require_protocol: true }) baseUrl!: string;
  @IsString() @Length(3, 240) credentialReference!: string;
}
export class MapLmsCourseDto {
  @IsUUID() classId!: string;
  @IsString() @Length(1, 128) externalCourseId!: string;
  @IsString() @Length(1, 160) displayName!: string;
  @IsUrl({ protocols: ["https"], require_protocol: true })
  @MaxLength(500)
  launchUrl!: string;
}

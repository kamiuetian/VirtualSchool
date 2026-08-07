import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
} from "class-validator";

export class AuthorizeClassroomDto {
  @IsString() @Length(3, 240) credentialReference!: string;
  @IsEmail() delegatedAdminEmail!: string;
}
export class MapClassroomCourseDto {
  @IsUUID() classId!: string;
  @IsString() @Length(1, 128) externalCourseId!: string;
  @IsOptional() @IsString() @MaxLength(200) externalCourseName?: string;
  @IsBoolean() @Type(() => Boolean) syncRoster!: boolean;
  @IsBoolean() @Type(() => Boolean) syncMaterials!: boolean;
}
export class MapClassroomIdentityDto {
  @IsIn(["STUDENT", "TEACHER"]) localType!: "STUDENT" | "TEACHER";
  @IsUUID() localId!: string;
  @IsString() @Length(1, 128) externalUserId!: string;
  @IsOptional() @IsEmail() externalEmail?: string;
}
export class StartClassroomSyncDto {
  @IsArray() @IsUUID("4", { each: true }) courseMappingIds!: string[];
  @IsBoolean() syncRoster!: boolean;
  @IsBoolean() syncMaterials!: boolean;
}

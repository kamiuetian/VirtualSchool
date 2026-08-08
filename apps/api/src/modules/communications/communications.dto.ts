import {
  IsArray,
  IsIn,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  Length,
} from "class-validator";
import { apiRoles } from "../auth/rbac";

export class CreateAnnouncementDto {
  @IsString() @Length(3, 120) title!: string;
  @IsString() @Length(3, 2000) message!: string;
  @IsArray() @IsIn(apiRoles, { each: true }) targetRoles!: string[];
  @IsISO8601() startsAt!: string;
  @IsISO8601() @IsOptional() endsAt?: string;
}
export class CreateFeedbackDto {
  @IsString() @Length(2, 80) module!: string;
  @IsIn(["LOW", "MEDIUM", "HIGH", "CRITICAL"]) severity!: string;
  @IsString() @Length(3, 1000) summary!: string;
  @IsObject() @IsOptional() context?: Record<string, string | number | boolean>;
}
export class UpdateFeedbackDto {
  @IsIn(["NEW", "TRIAGED", "IN_PROGRESS", "RESOLVED", "CLOSED"])
  status!: string;
}

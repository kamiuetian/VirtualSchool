import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
} from "class-validator";
import { apiPermissions } from "../auth/rbac";

export class CreateAccessRoleTemplateDto {
  @IsString() @Length(2, 80) name!: string;
  @IsOptional() @IsString() @Length(0, 300) description?: string;
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(18)
  @IsIn(apiPermissions, { each: true })
  permissions!: string[];
}
export class AssignAccessRoleDto {
  @IsUUID() userId!: string;
  @IsUUID() templateId!: string;
  @IsIn(["TENANT", "REGION", "BRANCH"]) scopeType!:
    | "TENANT"
    | "REGION"
    | "BRANCH";
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  regionCodes?: string[];
  @IsOptional() @IsUUID() branchId?: string;
  @IsOptional() @IsDateString() expiresAt?: string;
}
export class CreateAccessReviewDto {
  @IsString() @Length(2, 100) name!: string;
  @IsDateString() dueAt!: string;
}
export class DecideAccessReviewDto {
  @IsIn(["CONFIRMED", "REVOKED"]) decision!: "CONFIRMED" | "REVOKED";
  @IsString() @Length(3, 500) reason!: string;
}

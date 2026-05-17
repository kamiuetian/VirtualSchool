import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
} from "class-validator";
import type { StaffRole } from "@virtual-school/shared";

const staffRoles = [
  "SCHOOL_ADMIN",
  "IT_ADMIN",
  "ACADEMIC_ADMIN",
  "TEACHER",
  "SUPPORT_AGENT",
  "BILLING_ADMIN",
  "AUDITOR",
] as const satisfies readonly StaffRole[];

export class InviteUserDto {
  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ enum: staffRoles })
  @IsIn(staffRoles)
  role!: StaffRole;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  auth0Subject?: string;
}

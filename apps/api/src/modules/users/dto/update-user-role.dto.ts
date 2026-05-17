import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString } from "class-validator";
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

export class UpdateUserRoleDto {
  @ApiProperty({ enum: staffRoles })
  @IsIn(staffRoles)
  role!: StaffRole;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

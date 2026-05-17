import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsIn, IsNotEmpty, IsOptional, IsString } from "class-validator";

const tenantStatuses = ["ACTIVE", "PILOT", "SUSPENDED", "ARCHIVED"] as const;

export class CreateTenantDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  country!: string;

  @ApiProperty({ example: "Asia/Karachi" })
  @IsString()
  @IsNotEmpty()
  timezone!: string;

  @ApiProperty({ example: "starter" })
  @IsString()
  @IsNotEmpty()
  planKey!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEmail()
  primaryContactEmail?: string;

  @ApiProperty({ enum: tenantStatuses, default: "PILOT" })
  @IsIn(tenantStatuses)
  status: (typeof tenantStatuses)[number] = "PILOT";
}

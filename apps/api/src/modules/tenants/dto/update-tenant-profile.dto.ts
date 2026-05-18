import { ApiProperty } from "@nestjs/swagger";
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
} from "class-validator";

export class UpdateTenantProfileDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  country?: string;

  @ApiProperty({ example: "Asia/Karachi", required: false })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  timezone?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUrl({ require_tld: false })
  logoUrl?: string;

  @ApiProperty({ example: "#116b5f", required: false })
  @IsOptional()
  @Matches(/^#[0-9a-fA-F]{6}$/)
  primaryColor?: string;

  @ApiProperty({ example: "#315f91", required: false })
  @IsOptional()
  @Matches(/^#[0-9a-fA-F]{6}$/)
  accentColor?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUrl({ require_tld: false })
  websiteUrl?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEmail()
  supportEmail?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  supportPhone?: string;
}

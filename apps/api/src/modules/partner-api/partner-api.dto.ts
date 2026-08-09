import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

export const machineScopes = [
  "tenant.read",
  "roster.read",
  "roster.write",
  "devices.read",
  "reports.read",
  "audit.read",
] as const;

export class CreateMachineCredentialDto {
  @IsString() @MinLength(2) @MaxLength(80) name!: string;
  @ApiProperty({ enum: ["API_KEY", "OAUTH_CLIENT"] })
  @IsIn(["API_KEY", "OAUTH_CLIENT"])
  kind!: "API_KEY" | "OAUTH_CLIENT";
  @ApiProperty({ enum: machineScopes, isArray: true })
  @IsArray()
  @IsIn(machineScopes, { each: true })
  scopes!: string[];
  @ApiPropertyOptional({ default: 120 })
  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(5000)
  rateLimitPerMinute?: number;
}

export class RotateMachineCredentialDto {
  @ApiPropertyOptional({ default: 15 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1440)
  graceMinutes?: number;
}

export class ClientCredentialsDto {
  @IsString() client_id!: string;
  @IsString() @MinLength(20) client_secret!: string;
  @IsOptional() @IsString() grant_type?: string;
}

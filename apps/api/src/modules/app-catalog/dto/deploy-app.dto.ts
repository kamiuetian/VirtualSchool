import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";
import type {
  AppDeploymentAction,
  AppDeploymentScope,
} from "@virtual-school/shared";

const deploymentActions = ["INSTALL", "REMOVE"] as const;
const deploymentScopes = [
  "TENANT",
  "GRADE",
  "CLASS",
  "STUDENT",
  "DEVICE",
] as const;

export class DeployAppDto {
  @ApiProperty({ enum: deploymentActions })
  @IsIn(deploymentActions)
  action!: AppDeploymentAction;

  @ApiProperty({ enum: deploymentScopes })
  @IsIn(deploymentScopes)
  scope!: AppDeploymentScope;

  @ApiPropertyOptional({
    description:
      "Required for grade, class, student, and device deployments. Omit for tenant deployments.",
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  scopeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({
    default: 120,
    maximum: 1440,
    minimum: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1440)
  ttlMinutes?: number;

  @ApiPropertyOptional({
    default: 3,
    maximum: 10,
    minimum: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  maxAttempts?: number;
}

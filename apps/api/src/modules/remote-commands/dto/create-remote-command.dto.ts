import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";
import type { RemoteCommandType } from "@virtual-school/shared";

const remoteCommandTypes = [
  "LOCK",
  "UNLOCK",
  "WIPE",
  "REQUEST_CHECK_IN",
  "POLICY_REFRESH",
  "SEND_MESSAGE",
  "APP_INSTALL",
  "APP_REMOVE",
  "RETIRE",
] as const satisfies readonly RemoteCommandType[];

export class CreateRemoteCommandDto {
  @ApiProperty({ enum: remoteCommandTypes })
  @IsIn(remoteCommandTypes)
  type!: RemoteCommandType;

  @ApiPropertyOptional({
    description: "Operational reason captured in the audit trail",
  })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({
    description: "Connector-specific command payload",
    type: Object,
  })
  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;

  @ApiPropertyOptional({
    default: 60,
    description: "Minutes before an undelivered command expires",
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
    description: "Maximum dispatch attempts before the command is failed",
    maximum: 10,
    minimum: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  maxAttempts?: number;

  @ApiPropertyOptional({
    description: "Required for high-impact non-wipe operations such as RETIRE",
  })
  @IsOptional()
  @IsBoolean()
  confirmed?: boolean;
}

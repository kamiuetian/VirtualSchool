import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";

export class IssueSupportUnlockDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  deviceId!: string;

  @ApiProperty({ description: "Published emergency-support policy to apply" })
  @IsString()
  @IsNotEmpty()
  policyId!: string;

  @ApiProperty({ maximum: 480, minimum: 5 })
  @IsInt()
  @Min(5)
  @Max(480)
  durationMinutes!: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  reason!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  actorId?: string;
}

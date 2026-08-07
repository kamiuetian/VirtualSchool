import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsDateString,
  IsInt,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from "class-validator";

export class IngestBlockedDomainEventDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  deviceId?: string;

  @ApiProperty({ example: "learning.example.edu" })
  @IsString()
  @IsNotEmpty()
  domain!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  matchedRule?: string;

  @ApiProperty()
  @IsDateString()
  occurredAt!: string;

  @ApiProperty()
  @IsIn(["BLOCKLIST", "DEFAULT_DENY", "EMPTY_URL", "UNSUPPORTED_SCHEME"])
  @IsString()
  policyId!: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  policyVersion!: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  reason!: string;
}

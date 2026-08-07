import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from "class-validator";

export class RollbackPolicyDto {
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  version!: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  reason!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  actorId?: string;
}

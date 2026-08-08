import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";

export class CreateSupportTicketDto {
  @ApiProperty({ maxLength: 120 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  subject!: string;
  @ApiProperty({ maxLength: 2000 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  description!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() deviceId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() studentId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() classId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() sessionId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() category?: string;
  @ApiPropertyOptional({ enum: ["LOW", "NORMAL", "HIGH", "URGENT"] })
  @IsOptional()
  @IsIn(["LOW", "NORMAL", "HIGH", "URGENT"])
  priority?: string;
}

export class UpdateSupportTicketDto extends PartialType(
  CreateSupportTicketDto,
) {
  @ApiPropertyOptional({
    enum: ["OPEN", "IN_PROGRESS", "WAITING", "RESOLVED", "CLOSED"],
  })
  @IsOptional()
  @IsIn(["OPEN", "IN_PROGRESS", "WAITING", "RESOLVED", "CLOSED"])
  status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() assigneeId?: string;
}

export class CreateTicketNoteDto {
  @ApiProperty({ maxLength: 2000 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  body!: string;
  @ApiPropertyOptional({ enum: ["INTERNAL", "SCHOOL"] })
  @IsOptional()
  @IsIn(["INTERNAL", "SCHOOL"])
  visibility?: string;
}

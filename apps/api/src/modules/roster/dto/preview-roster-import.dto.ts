import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString } from "class-validator";

export class PreviewRosterImportDto {
  @ApiProperty({
    description: "Raw CSV content for roster import preview",
  })
  @IsString()
  @IsNotEmpty()
  csv!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  filename?: string;
}

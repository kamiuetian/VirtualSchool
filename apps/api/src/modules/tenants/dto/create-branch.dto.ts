import { ApiProperty } from "@nestjs/swagger";
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from "class-validator";

const dataRegions = ["PK", "EU", "US", "APAC"] as const;

export class CreateBranchDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ required: false, example: "America/New_York" })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiProperty({ example: "NORTH", required: false })
  @IsOptional()
  @Matches(/^[A-Z][A-Z0-9_-]{1,31}$/)
  regionCode?: string;

  @ApiProperty({ enum: dataRegions, required: false })
  @IsOptional()
  @IsIn(dataRegions)
  dataRegion?: (typeof dataRegions)[number];
}

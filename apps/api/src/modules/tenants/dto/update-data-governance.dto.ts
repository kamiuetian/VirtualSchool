import { ApiProperty } from "@nestjs/swagger";
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsString,
  Matches,
} from "class-validator";

export const dataRegions = ["PK", "EU", "US", "APAC"] as const;

export class UpdateDataGovernanceDto {
  @ApiProperty({ enum: dataRegions })
  @IsIn(dataRegions)
  dataRegion!: (typeof dataRegions)[number];

  @ApiProperty({ example: ["NORTH", "SOUTH"] })
  @IsArray()
  @ArrayMaxSize(32)
  @ArrayUnique()
  @IsString({ each: true })
  @Matches(/^[A-Z][A-Z0-9_-]{1,31}$/, { each: true })
  allowedRegionCodes!: string[];
}

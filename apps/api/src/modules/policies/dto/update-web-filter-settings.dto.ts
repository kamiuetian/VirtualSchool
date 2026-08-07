import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsString,
  ValidateNested,
} from "class-validator";
import { webFilterCategories } from "@virtual-school/shared";

class SafeSearchDto {
  @IsBoolean()
  google!: boolean;

  @IsBoolean()
  bing!: boolean;

  @IsIn(["OFF", "MODERATE", "STRICT"])
  youtubeRestrictedMode!: "OFF" | "MODERATE" | "STRICT";
}

export class UpdateWebFilterSettingsDto {
  @IsArray()
  @ArrayMaxSize(webFilterCategories.length)
  @IsIn(webFilterCategories, { each: true })
  blockedCategories!: (typeof webFilterCategories)[number][];

  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  neverAllowedUrls!: string[];

  @ValidateNested()
  @Type(() => SafeSearchDto)
  safeSearch!: SafeSearchDto;
}

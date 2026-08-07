import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
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

export class EducationalVideoEntryDto {
  @IsIn(["CHANNEL", "PLAYLIST", "VIDEO", "DOMAIN"])
  kind!: "CHANNEL" | "PLAYLIST" | "VIDEO" | "DOMAIN";
  @IsString()
  value!: string;
  @IsIn(["TENANT", "GRADE", "CLASS", "MODE"])
  scope!: "TENANT" | "GRADE" | "CLASS" | "MODE";
  @IsOptional()
  @IsString()
  scopeId?: string;
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

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => EducationalVideoEntryDto)
  educationalVideoAllowlist!: EducationalVideoEntryDto[];

  @ValidateNested()
  @Type(() => SafeSearchDto)
  safeSearch!: SafeSearchDto;
}

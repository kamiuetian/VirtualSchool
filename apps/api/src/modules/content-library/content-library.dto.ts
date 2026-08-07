import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
} from "class-validator";
import { contentLibraryTypes } from "@virtual-school/shared";

export class CreateContentLibraryItemDto {
  @IsString() @Length(1, 160) title!: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @IsIn(contentLibraryTypes) type!: (typeof contentLibraryTypes)[number];
  @IsString() @Length(1, 80) category!: string;
  @IsString() @Length(1, 1000) locator!: string;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  grades?: string[];
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  subjects?: string[];
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID(undefined, { each: true })
  classIds?: string[];
  @IsOptional() @IsDateString() expiresAt?: string;
}

export class UpdateContentLibraryItemDto {
  @IsOptional() @IsIn(["ACTIVE", "ARCHIVED"]) status?: "ACTIVE" | "ARCHIVED";
  @IsOptional() @IsDateString() expiresAt?: string;
}

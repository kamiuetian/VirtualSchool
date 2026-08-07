import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsISO8601,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Max,
  Min,
} from "class-validator";

export class CreateByodStudySessionDto {
  @IsString() @Length(2, 120) title!: string;
  @IsString() classId!: string;
  @IsISO8601() startsAt!: string;
  @IsISO8601() endsAt!: string;
  @IsArray()
  @ArrayMaxSize(30)
  @IsUrl({ protocols: ["https"], require_protocol: true }, { each: true })
  allowedUrls!: string[];
  @IsOptional()
  @IsIn(["CLASS", "GRADE", "EXAM"])
  eligibilityScope?: "CLASS" | "GRADE" | "EXAM";
  @IsOptional() @IsString() examAssignmentId?: string;
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsIn(["ANDROID", "CHROMEOS", "IOS", "MACOS", "WINDOWS"], { each: true })
  allowedPlatforms?: string[];
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsIn(["CHROME", "EDGE", "SAFARI"], { each: true })
  allowedBrowsers?: string[];
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(999)
  minimumBrowserMajorVersion?: number;
}

export class CheckByodReadinessDto {
  @IsIn(["ANDROID", "CHROMEOS", "IOS", "MACOS", "WINDOWS"])
  platform!: string;
  @IsIn(["CHROME", "EDGE", "SAFARI"])
  browser!: string;
  @IsInt() @Min(1) @Max(999) browserMajorVersion!: number;
  @IsBoolean() secureContext!: boolean;
  @IsBoolean() cookiesEnabled!: boolean;
  @IsBoolean() javascriptEnabled!: boolean;
}

export class ExitByodStudySessionDto {
  @IsString() @Length(2, 40) status!: string;
}

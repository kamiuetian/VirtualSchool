import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from "class-validator";

export class CreateAnalyticsExportScheduleDto {
  @IsString() @MaxLength(120) name!: string;
  @IsIn(["DAILY", "WEEKLY", "MONTHLY"]) cadence!: string;
  @IsIn(["CSV", "JSON"]) format!: string;
  @IsIn(["API_STORAGE", "OBJECT_STORAGE"]) destinationType!: string;
  @IsString()
  @Matches(/^(https:\/\/|s3:\/\/|ref:)/i, {
    message: "destinationReference must be HTTPS, s3, or an external reference",
  })
  destinationReference!: string;
  @IsDateString() nextRunAt!: string;
  @IsOptional() @IsBoolean() enabled?: boolean;
}

export class GenerateQuarterlyBusinessReviewDto {
  @IsString()
  @Matches(/^\d{4}-Q[1-4]$/, { message: "quarter must use YYYY-Q1 through YYYY-Q4" })
  quarter!: string;
}

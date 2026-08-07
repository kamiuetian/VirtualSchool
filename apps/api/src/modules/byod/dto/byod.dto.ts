import {
  ArrayMaxSize,
  IsArray,
  IsISO8601,
  IsString,
  IsUrl,
  Length,
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
}

export class ExitByodStudySessionDto {
  @IsString() @Length(2, 40) status!: string;
}

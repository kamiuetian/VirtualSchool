import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from "class-validator";

export class PublishPrivacyNoticeDto {
  @IsString() @Length(2, 80) noticeType!: string;
  @IsIn(["WEB", "MOBILE", "EMAIL"]) channel!: "WEB" | "MOBILE" | "EMAIL";
  @IsString() @Length(2, 160) title!: string;
  @IsString() @Length(20, 50000) content!: string;
}

export class AcceptPrivacyNoticeDto {
  @IsIn(["WEB", "MOBILE", "EMAIL"]) channel!: "WEB" | "MOBILE" | "EMAIL";
}

export class RevokePrivacyAcceptanceDto {
  @IsString() @IsNotEmpty() @MaxLength(500) reason!: string;
}

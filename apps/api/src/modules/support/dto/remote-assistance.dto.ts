import { IsBoolean, IsOptional, IsString, Length } from "class-validator";

export class StartRemoteAssistanceDto {
  @IsString()
  deviceId!: string;

  @IsOptional()
  @IsString()
  ticketId?: string;

  @IsString()
  @Length(5, 500)
  purpose!: string;

  @IsString()
  @Length(2, 200)
  consentedBy!: string;

  @IsBoolean()
  noticeAcknowledged!: boolean;
}

export class EndRemoteAssistanceDto {
  @IsString()
  @Length(3, 1000)
  resolution!: string;
}

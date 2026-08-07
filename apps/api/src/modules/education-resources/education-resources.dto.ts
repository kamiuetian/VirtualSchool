import {
  IsIn,
  IsString,
  IsUrl,
  IsUUID,
  Length,
  MaxLength,
} from "class-validator";
export const educationProviders = [
  "MICROSOFT_365",
  "TEAMS",
  "ZOOM",
  "GOOGLE_MEET",
] as const;
export class ConfigureEducationConnectionDto {
  @IsIn(educationProviders) provider!: (typeof educationProviders)[number];
  @IsString() @Length(3, 240) credentialReference!: string;
}
export class MapEducationResourceDto {
  @IsUUID() classId!: string;
  @IsIn(educationProviders) provider!: (typeof educationProviders)[number];
  @IsString() @Length(1, 160) externalId!: string;
  @IsString() @Length(1, 160) displayName!: string;
  @IsUrl({ protocols: ["https"], require_protocol: true })
  @MaxLength(500)
  launchUrl!: string;
}

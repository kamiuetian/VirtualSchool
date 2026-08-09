import {
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from "class-validator";

export class CreateIntegrationSubmissionDto {
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) @Length(3, 80) slug!: string;
  @IsString() @Length(2, 120) name!: string;
  @IsString() @Length(10, 1000) description!: string;
  @IsString() @Length(2, 80) category!: string;
  @IsObject() manifest!: Record<string, unknown>;
}

export class ReviewIntegrationSubmissionDto {
  @IsIn(["IN_REVIEW", "APPROVED", "REJECTED", "PUBLISHED"])
  status!: "IN_REVIEW" | "APPROVED" | "REJECTED" | "PUBLISHED";
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
}

export class ConfigureIntegrationDto {
  @IsOptional() @IsObject() configuration?: Record<string, unknown>;
}

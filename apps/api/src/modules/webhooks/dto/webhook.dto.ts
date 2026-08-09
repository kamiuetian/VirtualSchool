import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
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
import { educationWebhookEventTypes } from "@virtual-school/shared";

export class ConfigureWebhookEndpointDto {
  @IsString() @Length(1, 80) name!: string;
  @IsUrl({ protocols: ["https"], require_protocol: true }) url!: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(6)
  @IsIn(educationWebhookEventTypes, { each: true })
  eventTypes!: string[];
  @IsString() @Length(1, 300) secretReference!: string;
  @IsOptional() @IsInt() @Min(1) @Max(5) maxAttempts?: number;
}

export class RotateWebhookSecretDto {
  @IsString() @Length(1, 300) secretReference!: string;
}

export class SetWebhookEnabledDto {
  @IsBoolean() enabled!: boolean;
}

export class RetryWebhookDeliveryDto {
  @IsString() @Length(3, 300) reason!: string;
}

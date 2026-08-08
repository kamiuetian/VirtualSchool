import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from "class-validator";

export class CreateAutomationRuleDto {
  @IsString() @Length(3, 100) name!: string;
  @IsIn(["DEVICE_OFFLINE", "POLICY_FAILURE_REPEATED"]) trigger!: string;
  @IsInt() @Min(1) @Max(20) threshold!: number;
  @IsInt() @Min(5) @Max(10080) windowMinutes!: number;
  @IsIn(["NOTIFY", "CREATE_TICKET"]) action!: string;
  @IsString() @Length(3, 120) title!: string;
  @IsIn(["INFO", "WARNING", "CRITICAL"]) severity!: string;
  @IsBoolean() @IsOptional() enabled?: boolean;
}

export class UpdateAutomationRuleDto extends CreateAutomationRuleDto {}

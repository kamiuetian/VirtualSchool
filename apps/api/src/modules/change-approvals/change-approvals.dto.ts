import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";
import { highRiskOperations } from "@virtual-school/shared";

export class UpdateApprovalConfigDto {
  @IsArray()
  @ArrayMaxSize(3)
  @IsIn(highRiskOperations, { each: true })
  enabledOperations!: (typeof highRiskOperations)[number][];
  @Type(() => Number) @IsInt() @Min(1) @Max(3) requiredApprovals!: number;
}
export class CreateChangeRequestDto {
  @IsIn(highRiskOperations) operation!: (typeof highRiskOperations)[number];
  @IsString() @IsNotEmpty() objectType!: string;
  @IsOptional() @IsString() objectId?: string;
  @IsString() @IsNotEmpty() summary!: string;
  @IsString() @IsNotEmpty() reason!: string;
  @IsOptional() @IsObject() oldValue?: Record<string, unknown>;
  @IsObject() newValue!: Record<string, unknown>;
}
export class DecideChangeRequestDto {
  @IsIn(["APPROVED", "REJECTED"]) decision!: "APPROVED" | "REJECTED";
  @IsString() @IsNotEmpty() reason!: string;
}

import { IsIn, IsOptional, IsString, IsUrl } from "class-validator";

export class EvaluateEducationalVideoDto {
  @IsUrl({ protocols: ["https"], require_protocol: true })
  url!: string;
  @IsOptional()
  @IsIn(["TENANT", "GRADE", "CLASS", "MODE"])
  scope?: "TENANT" | "GRADE" | "CLASS" | "MODE";
  @IsOptional()
  @IsString()
  scopeId?: string;
}

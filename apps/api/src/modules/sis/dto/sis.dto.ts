import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsString,
  Length,
  ValidateNested,
} from "class-validator";

export class SisReconciliationRecordDto {
  @IsIn(["STUDENT", "CLASS", "TEACHER", "GUARDIAN", "ENROLLMENT"])
  objectType!: "STUDENT" | "CLASS" | "TEACHER" | "GUARDIAN" | "ENROLLMENT";
  @IsString() @Length(1, 200) localId!: string;
  @IsString() @Length(1, 200) externalId!: string;
}

export class ReconcileSisDto {
  @IsString() @Length(1, 80) source!: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => SisReconciliationRecordDto)
  records!: SisReconciliationRecordDto[];
}

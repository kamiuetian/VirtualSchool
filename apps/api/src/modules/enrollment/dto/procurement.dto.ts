import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from "class-validator";

export class CreateProcurementBatchDto {
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(80) reference!: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(120) vendor!: string;
  @ApiProperty() @IsDateString() purchaseDate!: string;
  @ApiProperty() @IsInt() @Min(1) expectedDevices!: number;
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(1000)
  @IsString({ each: true })
  serialNumbers?: string[];
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class AdvanceProcurementBatchDto {
  @ApiProperty({
    enum: ["RECEIVED", "ENROLLING", "READY", "SHIPPED", "ASSIGNED", "CLOSED"],
  })
  @IsIn(["RECEIVED", "ENROLLING", "READY", "SHIPPED", "ASSIGNED", "CLOSED"])
  status!: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(500) reason!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  shippingCarrier?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  trackingNumber?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  destination?: string;
}

export class LinkProcurementDeviceDto {
  @ApiProperty() @IsString() @IsNotEmpty() deviceId!: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(500) reason!: string;
}

export class RecordRmaDto {
  @ApiProperty({ enum: ["RMA_REQUESTED", "RMA_SHIPPED", "REPLACED"] })
  @IsIn(["RMA_REQUESTED", "RMA_SHIPPED", "REPLACED"])
  status!: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(120) rmaNumber!: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(500) reason!: string;
}

export class ReplaceDeviceDto {
  @ApiProperty() @IsString() @IsNotEmpty() replacementDeviceId!: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(500) reason!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  rmaNumber?: string;
}

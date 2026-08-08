import { ApiPropertyOptional } from "@nestjs/swagger";
import { devicePlatforms } from "@virtual-school/shared";
import { IsIn, IsOptional, IsString } from "class-validator";

export class ListDevicesDto {
  @ApiPropertyOptional({ enum: devicePlatforms })
  @IsIn(devicePlatforms)
  @IsOptional()
  platform?: (typeof devicePlatforms)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  provider?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  compliance?: string;

  @ApiPropertyOptional({ enum: ["FULLY_MANAGED", "SUPERVISED", "USER_ENROLLED", "BYOD_SESSION", "UNKNOWN"] })
  @IsIn(["FULLY_MANAGED", "SUPERVISED", "USER_ENROLLED", "BYOD_SESSION", "UNKNOWN"])
  @IsOptional()
  enrollmentType?: "FULLY_MANAGED" | "SUPERVISED" | "USER_ENROLLED" | "BYOD_SESSION" | "UNKNOWN";

  @ApiPropertyOptional({ enum: ["SCHOOL_OWNED", "PERSONAL", "CORPORATE"] })
  @IsIn(["SCHOOL_OWNED", "PERSONAL", "CORPORATE"])
  @IsOptional()
  ownershipType?: "SCHOOL_OWNED" | "PERSONAL" | "CORPORATE";
}

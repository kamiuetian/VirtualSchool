import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class DeviceLifecycleDto {
  @ApiProperty({
    description: "Required justification for this lifecycle operation.",
  })
  @IsString()
  @IsNotEmpty()
  reason!: string;
}

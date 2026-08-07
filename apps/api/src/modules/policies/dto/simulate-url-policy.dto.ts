import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, IsUrl } from "class-validator";

export class SimulateUrlPolicyDto {
  @ApiProperty({ example: "https://learning.example.edu/lesson/1" })
  @IsUrl({
    protocols: ["http", "https"],
    require_protocol: true,
    require_tld: false,
  })
  @IsString()
  @IsNotEmpty()
  url!: string;
}

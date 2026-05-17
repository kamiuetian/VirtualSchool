import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class RecordDeliveryFailureDto {
  @ApiPropertyOptional({
    description: "Connector id from the failed delivery attempt",
  })
  @IsOptional()
  @IsString()
  connectorCommandId?: string;

  @ApiPropertyOptional({
    description: "Failure reason from the connector or dispatch worker",
  })
  @IsOptional()
  @IsString()
  failureReason?: string;
}

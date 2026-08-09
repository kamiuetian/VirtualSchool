import { Module } from "@nestjs/common";
import {
  MachineCredentialsController,
  PartnerApiController,
  PartnerAuthController,
} from "./partner-api.controller";
import { PartnerApiService } from "./partner-api.service";
@Module({
  controllers: [
    MachineCredentialsController,
    PartnerAuthController,
    PartnerApiController,
  ],
  providers: [PartnerApiService],
})
export class PartnerApiModule {}

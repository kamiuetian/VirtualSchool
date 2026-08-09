import { Module } from "@nestjs/common";
import { EnterpriseIdentityController } from "./enterprise-identity.controller";
import { EnterpriseIdentityService } from "./enterprise-identity.service";
@Module({
  controllers: [EnterpriseIdentityController],
  providers: [EnterpriseIdentityService],
})
export class EnterpriseIdentityModule {}

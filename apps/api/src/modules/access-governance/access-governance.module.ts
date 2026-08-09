import { Module } from "@nestjs/common";
import { AccessGovernanceController } from "./access-governance.controller";
import { AccessGovernanceService } from "./access-governance.service";
@Module({
  controllers: [AccessGovernanceController],
  providers: [AccessGovernanceService],
})
export class AccessGovernanceModule {}

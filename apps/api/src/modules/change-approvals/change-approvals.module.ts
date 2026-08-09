import { Module } from "@nestjs/common";
import { ChangeApprovalsController } from "./change-approvals.controller";
import { ChangeApprovalsService } from "./change-approvals.service";
@Module({
  controllers: [ChangeApprovalsController],
  providers: [ChangeApprovalsService],
})
export class ChangeApprovalsModule {}

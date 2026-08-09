import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { PartnerReportsController, ReportsController } from "./reports.controller";
import { ReportsService } from "./reports.service";

@Module({
  controllers: [ReportsController, PartnerReportsController],
  exports: [ReportsService],
  imports: [PrismaModule],
  providers: [ReportsService],
})
export class ReportsModule {}

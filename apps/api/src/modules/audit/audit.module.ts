import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { AuditController } from "./audit.controller";
import { AuditService } from "./audit.service";

@Module({
  controllers: [AuditController],
  exports: [AuditService],
  imports: [PrismaModule],
  providers: [AuditService],
})
export class AuditModule {}

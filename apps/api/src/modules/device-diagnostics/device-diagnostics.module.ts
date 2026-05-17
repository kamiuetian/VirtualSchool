import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { DeviceDiagnosticsController } from "./device-diagnostics.controller";
import { DeviceDiagnosticsService } from "./device-diagnostics.service";

@Module({
  controllers: [DeviceDiagnosticsController],
  imports: [PrismaModule],
  providers: [DeviceDiagnosticsService],
})
export class DeviceDiagnosticsModule {}

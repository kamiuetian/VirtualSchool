import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { AndroidManagementCommandMapper } from "./android-management-command.mapper";
import { AndroidManagementConnector } from "./android-management.connector";
import { CommandDispatchController } from "./command-dispatch.controller";
import { CommandDispatchService } from "./command-dispatch.service";
import { MdmConnectorRegistry } from "./mdm-connector.registry";
import { StubMdmConnector } from "./stub-mdm.connector";

@Module({
  controllers: [CommandDispatchController],
  exports: [CommandDispatchService, MdmConnectorRegistry],
  imports: [PrismaModule],
  providers: [
    AndroidManagementCommandMapper,
    AndroidManagementConnector,
    CommandDispatchService,
    MdmConnectorRegistry,
    StubMdmConnector,
  ],
})
export class MdmConnectorsModule {}

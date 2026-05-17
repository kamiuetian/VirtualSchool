import { Module } from "@nestjs/common";
import { MdmConnectorsModule } from "../mdm-connectors/mdm-connectors.module";
import { PrismaModule } from "../prisma/prisma.module";
import { PoliciesController } from "./policies.controller";
import { PoliciesService } from "./policies.service";

@Module({
  controllers: [PoliciesController],
  imports: [PrismaModule, MdmConnectorsModule],
  providers: [PoliciesService],
})
export class PoliciesModule {}

import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { MdmConnectorsModule } from "../mdm-connectors/mdm-connectors.module";
import { EnrollmentController } from "./enrollment.controller";
import { EnrollmentService } from "./enrollment.service";

@Module({
  controllers: [EnrollmentController],
  imports: [PrismaModule, MdmConnectorsModule],
  providers: [EnrollmentService],
})
export class EnrollmentModule {}

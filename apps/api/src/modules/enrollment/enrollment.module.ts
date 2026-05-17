import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { EnrollmentController } from "./enrollment.controller";
import { EnrollmentService } from "./enrollment.service";

@Module({
  controllers: [EnrollmentController],
  imports: [PrismaModule],
  providers: [EnrollmentService],
})
export class EnrollmentModule {}

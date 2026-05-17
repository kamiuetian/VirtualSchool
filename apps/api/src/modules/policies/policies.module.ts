import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { PoliciesController } from "./policies.controller";
import { PoliciesService } from "./policies.service";

@Module({
  controllers: [PoliciesController],
  imports: [PrismaModule],
  providers: [PoliciesService],
})
export class PoliciesModule {}

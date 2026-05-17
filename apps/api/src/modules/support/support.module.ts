import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { SupportController } from "./support.controller";
import { SupportService } from "./support.service";

@Module({
  controllers: [SupportController],
  imports: [PrismaModule],
  providers: [SupportService],
})
export class SupportModule {}

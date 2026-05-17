import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { AppCatalogController } from "./app-catalog.controller";
import { AppCatalogService } from "./app-catalog.service";

@Module({
  controllers: [AppCatalogController],
  imports: [PrismaModule],
  providers: [AppCatalogService],
})
export class AppCatalogModule {}

import { Module } from "@nestjs/common";
import { SisController } from "./sis.controller";
import { SisService } from "./sis.service";
@Module({ controllers: [SisController], providers: [SisService] })
export class SisModule {}

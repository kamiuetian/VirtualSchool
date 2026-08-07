import { Module } from "@nestjs/common";
import { ByodController } from "./byod.controller";
import { ByodService } from "./byod.service";

@Module({ controllers: [ByodController], providers: [ByodService] })
export class ByodModule {}

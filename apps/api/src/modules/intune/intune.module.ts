import { Module } from "@nestjs/common";
import { IntuneController } from "./intune.controller";
import { IntuneService } from "./intune.service";
@Module({ controllers: [IntuneController], providers: [IntuneService] })
export class IntuneModule {}

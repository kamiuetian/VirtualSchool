import { Module } from "@nestjs/common";
import { AppleMdmController } from "./apple-mdm.controller";
import { AppleMdmService } from "./apple-mdm.service";
@Module({ controllers: [AppleMdmController], providers: [AppleMdmService] })
export class AppleMdmModule {}

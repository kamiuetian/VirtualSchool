import { Module } from "@nestjs/common";
import { ResellerController } from "./reseller.controller";
import { ResellerService } from "./reseller.service";
@Module({ controllers: [ResellerController], providers: [ResellerService] })
export class ResellerModule {}

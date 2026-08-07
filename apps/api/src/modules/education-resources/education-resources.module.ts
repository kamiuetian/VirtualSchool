import { Module } from "@nestjs/common";
import { EducationResourcesController } from "./education-resources.controller";
import { EducationResourcesService } from "./education-resources.service";
@Module({
  controllers: [EducationResourcesController],
  providers: [EducationResourcesService],
})
export class EducationResourcesModule {}

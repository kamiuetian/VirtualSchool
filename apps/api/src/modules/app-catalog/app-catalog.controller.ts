import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type { AppCatalogItemSummary } from "@virtual-school/shared";
import { AppCatalogService } from "./app-catalog.service";
import { CreateAppCatalogItemDto } from "./dto/create-app-catalog-item.dto";
import { UpdateAppCatalogItemDto } from "./dto/update-app-catalog-item.dto";

@ApiTags("app-catalog")
@Controller("tenants/:tenantId/apps")
export class AppCatalogController {
  constructor(
    @Inject(AppCatalogService)
    private readonly appCatalogService: AppCatalogService,
  ) {}

  @Get()
  @ApiOkResponse({ description: "Tenant approved app catalog" })
  listApps(
    @Param("tenantId") tenantId: string,
  ): Promise<AppCatalogItemSummary[]> {
    return this.appCatalogService.listApps(tenantId);
  }

  @Post()
  @ApiCreatedResponse({ description: "Create an approved app catalog entry" })
  createApp(
    @Param("tenantId") tenantId: string,
    @Body() body: CreateAppCatalogItemDto,
  ): Promise<AppCatalogItemSummary> {
    return this.appCatalogService.createApp(tenantId, body);
  }

  @Patch(":appId")
  @ApiOkResponse({
    description:
      "Update app catalog metadata, grades, install rules, or status",
  })
  updateApp(
    @Param("tenantId") tenantId: string,
    @Param("appId") appId: string,
    @Body() body: UpdateAppCatalogItemDto,
  ): Promise<AppCatalogItemSummary> {
    return this.appCatalogService.updateApp(tenantId, appId, body);
  }
}

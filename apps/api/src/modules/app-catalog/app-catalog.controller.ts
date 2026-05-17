import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Req,
} from "@nestjs/common";
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type {
  AppCatalogItemSummary,
  AppDeploymentSummary,
} from "@virtual-school/shared";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator";
import type { AuthenticatedRequest } from "../auth/types/authenticated-request";
import { AppCatalogService } from "./app-catalog.service";
import { CreateAppCatalogItemDto } from "./dto/create-app-catalog-item.dto";
import { DeployAppDto } from "./dto/deploy-app.dto";
import { UpdateAppCatalogItemDto } from "./dto/update-app-catalog-item.dto";

@ApiTags("app-catalog")
@Controller("tenants/:tenantId/apps")
export class AppCatalogController {
  constructor(
    @Inject(AppCatalogService)
    private readonly appCatalogService: AppCatalogService,
  ) {}

  @Get()
  @RequirePermissions("tenant:read")
  @ApiOkResponse({ description: "Tenant approved app catalog" })
  listApps(
    @Param("tenantId") tenantId: string,
  ): Promise<AppCatalogItemSummary[]> {
    return this.appCatalogService.listApps(tenantId);
  }

  @Post()
  @RequirePermissions("policy:manage")
  @ApiCreatedResponse({ description: "Create an approved app catalog entry" })
  createApp(
    @Param("tenantId") tenantId: string,
    @Body() body: CreateAppCatalogItemDto,
  ): Promise<AppCatalogItemSummary> {
    return this.appCatalogService.createApp(tenantId, body);
  }

  @Patch(":appId")
  @RequirePermissions("policy:manage")
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

  @Post(":appId/deployments")
  @RequirePermissions("device:command")
  @ApiCreatedResponse({
    description:
      "Queue app install or remove deployment commands for matching devices",
  })
  deployApp(
    @Param("tenantId") tenantId: string,
    @Param("appId") appId: string,
    @Body() body: DeployAppDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<AppDeploymentSummary> {
    return this.appCatalogService.deployApp(
      tenantId,
      appId,
      body,
      request.user?.subject,
    );
  }
}

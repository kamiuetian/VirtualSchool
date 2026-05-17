import { Controller, Get, Header, Inject, Param, Req } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type {
  AppDeploymentReport,
  DeviceInventoryReport,
  PolicyDeploymentReport,
} from "@virtual-school/shared";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator";
import type { AuthenticatedRequest } from "../auth/types/authenticated-request";
import { ReportsService } from "./reports.service";

@ApiTags("reports")
@Controller("tenants/:tenantId/reports")
export class ReportsController {
  constructor(
    @Inject(ReportsService) private readonly reportsService: ReportsService,
  ) {}

  @Get("device-inventory")
  @RequirePermissions("report:export")
  @ApiOkResponse({ description: "Device inventory report" })
  getDeviceInventoryReport(
    @Param("tenantId") tenantId: string,
  ): Promise<DeviceInventoryReport> {
    return this.reportsService.getDeviceInventoryReport(tenantId);
  }

  @Get("device-inventory.csv")
  @Header("Content-Type", "text/csv; charset=utf-8")
  @Header("Content-Disposition", 'attachment; filename="device-inventory.csv"')
  @RequirePermissions("report:export")
  @ApiOkResponse({ description: "Device inventory CSV export" })
  getDeviceInventoryCsv(
    @Param("tenantId") tenantId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<string> {
    return this.reportsService.getDeviceInventoryCsv(
      tenantId,
      request.user?.subject,
    );
  }

  @Get("policy-deployments")
  @RequirePermissions("report:export")
  @ApiOkResponse({ description: "Policy deployment report" })
  getPolicyDeploymentReport(
    @Param("tenantId") tenantId: string,
  ): Promise<PolicyDeploymentReport> {
    return this.reportsService.getPolicyDeploymentReport(tenantId);
  }

  @Get("app-deployments")
  @RequirePermissions("report:export")
  @ApiOkResponse({ description: "App deployment report" })
  getAppDeploymentReport(
    @Param("tenantId") tenantId: string,
  ): Promise<AppDeploymentReport> {
    return this.reportsService.getAppDeploymentReport(tenantId);
  }
}

import {
  Body,
  Controller,
  Get,
  Header,
  Inject,
  Param,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type {
  AppDeploymentReport,
  DeviceInventoryReport,
  LearningUsageAnalyticsReport,
  PolicyDeploymentReport,
} from "@virtual-school/shared";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator";
import type { AuthenticatedRequest } from "../auth/types/authenticated-request";
import { ReportsService } from "./reports.service";
import { CreateAnalyticsExportScheduleDto } from "./enterprise-reports.dto";

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

  @Get("learning-usage")
  @RequirePermissions("report:export")
  @ApiOkResponse({ description: "Learning access and device usage analytics" })
  getLearningUsageAnalytics(
    @Param("tenantId") tenantId: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("classId") classId?: string,
    @Query("grade") grade?: string,
    @Query("deviceGroup") deviceGroup?: string,
    @Query("category") category?: string,
  ): Promise<LearningUsageAnalyticsReport> {
    return this.reportsService.getLearningUsageAnalytics(tenantId, {
      category,
      classId,
      deviceGroup,
      from,
      grade,
      to,
    });
  }

  @Get("enterprise-analytics")
  @RequirePermissions("report:export")
  enterpriseAnalytics(
    @Param("tenantId") tenantId: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    return this.reportsService.getTenantEnterpriseAnalytics(tenantId, {
      from,
      to,
    });
  }

  @Get("enterprise-exports")
  @RequirePermissions("report:export")
  exportSchedules(@Param("tenantId") tenantId: string) {
    return this.reportsService.listTenantExportSchedules(tenantId);
  }

  @Post("enterprise-exports")
  @RequirePermissions("report:export")
  createExportSchedule(
    @Param("tenantId") tenantId: string,
    @Body() body: CreateAnalyticsExportScheduleDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.reportsService.createTenantExportSchedule(
      tenantId,
      body,
      request.user?.subject,
    );
  }

  @Post("enterprise-exports/:scheduleId/run")
  @RequirePermissions("report:export")
  runExport(
    @Param("tenantId") tenantId: string,
    @Param("scheduleId") scheduleId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.reportsService.runTenantExport(
      tenantId,
      scheduleId,
      request.user?.subject,
    );
  }
}

@ApiTags("partner-analytics")
@Controller("resellers/:partnerId/analytics")
@RequirePermissions("tenant:update")
export class PartnerReportsController {
  constructor(
    @Inject(ReportsService) private readonly reportsService: ReportsService,
  ) {}

  @Get()
  analytics(
    @Param("partnerId") partnerId: string,
    @Query("from") from: string | undefined,
    @Query("to") to: string | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.reportsService.getPartnerEnterpriseAnalytics(
      partnerId,
      request.user?.subject,
      { from, to },
    );
  }

  @Post("exports")
  createExport(
    @Param("partnerId") partnerId: string,
    @Body() body: CreateAnalyticsExportScheduleDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.reportsService.createPartnerExportSchedule(
      partnerId,
      body,
      request.user?.subject,
    );
  }

  @Post("exports/:scheduleId/run")
  runExport(
    @Param("partnerId") partnerId: string,
    @Param("scheduleId") scheduleId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.reportsService.runPartnerExport(
      partnerId,
      scheduleId,
      request.user?.subject,
    );
  }
}

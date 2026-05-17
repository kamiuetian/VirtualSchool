import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type {
  DeviceAlertSummary,
  DeviceDiagnosticSummary,
  DeviceDiagnosticUploadResult,
  OfflineAlertScanSummary,
} from "@virtual-school/shared";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator";
import type { AuthenticatedRequest } from "../auth/types/authenticated-request";
import { AlertActionDto } from "./dto/alert-action.dto";
import { OfflineAlertScanDto } from "./dto/offline-alert-scan.dto";
import { UploadDeviceDiagnosticDto } from "./dto/upload-device-diagnostic.dto";
import { DeviceDiagnosticsService } from "./device-diagnostics.service";

@ApiTags("device-diagnostics")
@Controller("tenants/:tenantId")
export class DeviceDiagnosticsController {
  constructor(
    @Inject(DeviceDiagnosticsService)
    private readonly deviceDiagnosticsService: DeviceDiagnosticsService,
  ) {}

  @Get("devices/:deviceId/diagnostics")
  @RequirePermissions("device:read")
  @ApiOkResponse({ description: "Recent privacy-limited device diagnostics" })
  listDeviceDiagnostics(
    @Param("tenantId") tenantId: string,
    @Param("deviceId") deviceId: string,
    @Query("limit") limit?: string,
  ): Promise<DeviceDiagnosticSummary[]> {
    return this.deviceDiagnosticsService.listDeviceDiagnostics(
      tenantId,
      deviceId,
      limit ? Number(limit) : undefined,
    );
  }

  @Post("devices/:deviceId/diagnostics")
  @RequirePermissions("device:command")
  @ApiCreatedResponse({
    description:
      "Upload technical diagnostics and create or resolve device alerts",
  })
  uploadDeviceDiagnostic(
    @Param("tenantId") tenantId: string,
    @Param("deviceId") deviceId: string,
    @Body() body: UploadDeviceDiagnosticDto,
  ): Promise<DeviceDiagnosticUploadResult> {
    return this.deviceDiagnosticsService.uploadDeviceDiagnostic(
      tenantId,
      deviceId,
      body,
    );
  }

  @Get("alerts")
  @RequirePermissions("device:read")
  @ApiOkResponse({ description: "Tenant device alerts" })
  listAlerts(
    @Param("tenantId") tenantId: string,
    @Query("status") status?: string,
    @Query("severity") severity?: string,
    @Query("deviceId") deviceId?: string,
    @Query("limit") limit?: string,
  ): Promise<DeviceAlertSummary[]> {
    return this.deviceDiagnosticsService.listAlerts(tenantId, {
      deviceId,
      limit: limit ? Number(limit) : undefined,
      severity,
      status,
    });
  }

  @Post("alerts/offline-scan")
  @RequirePermissions("device:read")
  @ApiCreatedResponse({
    description: "Create or refresh alerts for devices past check-in threshold",
  })
  scanOfflineAlerts(
    @Param("tenantId") tenantId: string,
    @Body() body: OfflineAlertScanDto,
  ): Promise<OfflineAlertScanSummary> {
    return this.deviceDiagnosticsService.scanOfflineAlerts(tenantId, body);
  }

  @Post("alerts/:alertId/acknowledge")
  @RequirePermissions("device:command")
  @ApiCreatedResponse({ description: "Acknowledge an open device alert" })
  acknowledgeAlert(
    @Param("tenantId") tenantId: string,
    @Param("alertId") alertId: string,
    @Body() body: AlertActionDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<DeviceAlertSummary> {
    return this.deviceDiagnosticsService.acknowledgeAlert(
      tenantId,
      alertId,
      body,
      request.user?.subject,
    );
  }

  @Post("alerts/:alertId/resolve")
  @RequirePermissions("device:command")
  @ApiCreatedResponse({ description: "Resolve a device alert" })
  resolveAlert(
    @Param("tenantId") tenantId: string,
    @Param("alertId") alertId: string,
    @Body() body: AlertActionDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<DeviceAlertSummary> {
    return this.deviceDiagnosticsService.resolveAlert(
      tenantId,
      alertId,
      body,
      request.user?.subject,
    );
  }
}

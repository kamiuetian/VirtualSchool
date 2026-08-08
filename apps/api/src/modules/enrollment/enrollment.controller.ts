import { Body, Controller, Get, Inject, Param, Post, Query } from "@nestjs/common";
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type {
  DeviceCheckInResult,
  DeviceHistory,
  DeviceSummary,
  EnrollmentBatchSummary,
  PlatformCapabilityCatalog,
} from "@virtual-school/shared";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator";
import { AssignDeviceDto } from "./dto/assign-device.dto";
import { CreateEnrollmentBatchDto } from "./dto/create-enrollment-batch.dto";
import { DeviceCheckInDto } from "./dto/device-check-in.dto";
import { DeviceLifecycleDto } from "./dto/device-lifecycle.dto";
import { ListDevicesDto } from "./dto/list-devices.dto";
import { EnrollmentService } from "./enrollment.service";

@ApiTags("enrollment")
@Controller("tenants/:tenantId")
export class EnrollmentController {
  constructor(
    @Inject(EnrollmentService)
    private readonly enrollmentService: EnrollmentService,
  ) {}

  @Get("enrollment-batches")
  @RequirePermissions("device:read")
  @ApiOkResponse({ description: "Tenant Android enrollment batches" })
  listEnrollmentBatches(
    @Param("tenantId") tenantId: string,
  ): Promise<EnrollmentBatchSummary[]> {
    return this.enrollmentService.listEnrollmentBatches(tenantId);
  }

  @Post("enrollment-batches")
  @RequirePermissions("device:enroll")
  @ApiCreatedResponse({
    description: "Create a QR-backed Android enrollment batch",
  })
  createEnrollmentBatch(
    @Param("tenantId") tenantId: string,
    @Body() body: CreateEnrollmentBatchDto,
  ): Promise<EnrollmentBatchSummary> {
    return this.enrollmentService.createEnrollmentBatch(tenantId, body);
  }

  @Get("devices")
  @RequirePermissions("device:read")
  @ApiOkResponse({ description: "Tenant unified device inventory" })
  listDevices(
    @Param("tenantId") tenantId: string,
    @Query() query: ListDevicesDto,
  ): Promise<DeviceSummary[]> {
    return this.enrollmentService.listDevices(tenantId, query);
  }

  @Get("device-capabilities")
  @RequirePermissions("device:read")
  @ApiOkResponse({ description: "Multi-OS management capability catalog" })
  listDeviceCapabilities(): PlatformCapabilityCatalog[] {
    return this.enrollmentService.listDeviceCapabilities();
  }

  @Post("devices/check-ins")
  @RequirePermissions("device:enroll")
  @ApiCreatedResponse({
    description: "Record a managed Android device check-in or first enrollment",
  })
  recordDeviceCheckIn(
    @Param("tenantId") tenantId: string,
    @Body() body: DeviceCheckInDto,
  ): Promise<DeviceCheckInResult> {
    return this.enrollmentService.recordDeviceCheckIn(tenantId, body);
  }

  @Post("devices/:deviceId/assignments")
  @RequirePermissions("device:enroll")
  @ApiCreatedResponse({
    description: "Assign a quarantined device to a branch, student, or class",
  })
  assignDevice(
    @Param("tenantId") tenantId: string,
    @Param("deviceId") deviceId: string,
    @Body() body: AssignDeviceDto,
  ): Promise<DeviceSummary> {
    return this.enrollmentService.assignDevice(tenantId, deviceId, body);
  }

  @Get("devices/:deviceId/history")
  @RequirePermissions("device:read")
  getDeviceHistory(
    @Param("tenantId") tenantId: string,
    @Param("deviceId") deviceId: string,
  ): Promise<DeviceHistory> {
    return this.enrollmentService.getDeviceHistory(tenantId, deviceId);
  }

  @Post("devices/:deviceId/retire")
  @RequirePermissions("device:enroll")
  retireDevice(
    @Param("tenantId") tenantId: string,
    @Param("deviceId") deviceId: string,
    @Body() body: DeviceLifecycleDto,
  ): Promise<DeviceSummary> {
    return this.enrollmentService.retireDevice(tenantId, deviceId, body.reason);
  }

  @Post("devices/:deviceId/unenroll")
  @RequirePermissions("device:enroll")
  unenrollDevice(
    @Param("tenantId") tenantId: string,
    @Param("deviceId") deviceId: string,
    @Body() body: DeviceLifecycleDto,
  ): Promise<DeviceSummary> {
    return this.enrollmentService.unenrollDevice(
      tenantId,
      deviceId,
      body.reason,
    );
  }
}

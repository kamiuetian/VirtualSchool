import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type {
  ActiveTimetableResolution,
  TimetableBlockSummary,
} from "@virtual-school/shared";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator";
import { CreateTimetableBlockDto } from "./dto/create-timetable-block.dto";
import { TimetableLifecycleDto } from "./dto/timetable-lifecycle.dto";
import { UpdateTimetableBlockDto } from "./dto/update-timetable-block.dto";
import { TimetableService } from "./timetable.service";

@ApiTags("timetable")
@Controller("tenants/:tenantId/timetable-blocks")
export class TimetableController {
  constructor(
    @Inject(TimetableService)
    private readonly timetableService: TimetableService,
  ) {}

  @Get()
  @RequirePermissions("tenant:read")
  @ApiOkResponse({ description: "Tenant recurring weekly timetable blocks" })
  listBlocks(
    @Param("tenantId") tenantId: string,
  ): Promise<TimetableBlockSummary[]> {
    return this.timetableService.listBlocks(tenantId);
  }

  @Get("active")
  @RequirePermissions("device:read")
  @ApiOkResponse({
    description: "Resolve the currently active timetable block for a device",
  })
  resolveActiveBlockForDevice(
    @Param("tenantId") tenantId: string,
    @Query("deviceId") deviceId: string,
    @Query("at") at?: string,
  ): Promise<ActiveTimetableResolution> {
    return this.timetableService.resolveActiveBlockForDevice(
      tenantId,
      deviceId,
      at ? new Date(at) : undefined,
    );
  }

  @Post()
  @RequirePermissions("policy:manage")
  @ApiCreatedResponse({ description: "Create a recurring timetable block" })
  createBlock(
    @Param("tenantId") tenantId: string,
    @Body() body: CreateTimetableBlockDto,
  ): Promise<TimetableBlockSummary> {
    return this.timetableService.createBlock(tenantId, body);
  }

  @Patch(":blockId")
  @RequirePermissions("policy:manage")
  @ApiOkResponse({ description: "Update a recurring timetable block" })
  updateBlock(
    @Param("tenantId") tenantId: string,
    @Param("blockId") blockId: string,
    @Body() body: UpdateTimetableBlockDto,
  ): Promise<TimetableBlockSummary> {
    return this.timetableService.updateBlock(tenantId, blockId, body);
  }

  @Post(":blockId/deactivate")
  @RequirePermissions("policy:manage")
  @ApiCreatedResponse({ description: "Deactivate a timetable block" })
  deactivateBlock(
    @Param("tenantId") tenantId: string,
    @Param("blockId") blockId: string,
    @Body() body: TimetableLifecycleDto,
  ): Promise<TimetableBlockSummary> {
    return this.timetableService.deactivateBlock(tenantId, blockId, body);
  }
}

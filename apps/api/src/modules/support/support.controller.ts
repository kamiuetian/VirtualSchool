import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type {
  RetentionRunSummary,
  RetentionSettingsSummary,
  SupportNoteSummary,
  SupportTimelineEvent,
} from "@virtual-school/shared";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator";
import type { AuthenticatedRequest } from "../auth/types/authenticated-request";
import { CreateSupportNoteDto } from "./dto/create-support-note.dto";
import { RunRetentionDto } from "./dto/run-retention.dto";
import { UpdateRetentionSettingsDto } from "./dto/update-retention-settings.dto";
import { UpdateSupportNoteDto } from "./dto/update-support-note.dto";
import { SupportService } from "./support.service";
import {
  CreateSupportTicketDto,
  CreateTicketNoteDto,
  UpdateSupportTicketDto,
} from "./dto/support-ticket.dto";
import {
  EndRemoteAssistanceDto,
  StartRemoteAssistanceDto,
} from "./dto/remote-assistance.dto";

@ApiTags("support")
@Controller("tenants/:tenantId")
export class SupportController {
  constructor(
    @Inject(SupportService) private readonly supportService: SupportService,
  ) {}

  @Get("support/assistance/playbooks")
  @RequirePermissions("device:read")
  getTroubleshootingPlaybooks() {
    return this.supportService.getTroubleshootingPlaybooks();
  }

  @Get("support/assistance/sessions")
  @RequirePermissions("device:command")
  listAssistanceSessions(
    @Param("tenantId") tenantId: string,
    @Query("deviceId") deviceId?: string,
  ) {
    return this.supportService.listAssistanceSessions(tenantId, deviceId);
  }

  @Post("support/assistance/sessions")
  @RequirePermissions("device:command")
  startAssistanceSession(
    @Param("tenantId") tenantId: string,
    @Body() body: StartRemoteAssistanceDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.supportService.startAssistanceSession(
      tenantId,
      body,
      request.user,
    );
  }

  @Post("support/assistance/sessions/:sessionId/end")
  @RequirePermissions("device:command")
  endAssistanceSession(
    @Param("tenantId") tenantId: string,
    @Param("sessionId") sessionId: string,
    @Body() body: EndRemoteAssistanceDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.supportService.endAssistanceSession(
      tenantId,
      sessionId,
      body,
      request.user,
    );
  }

  @Get("support/tickets")
  @RequirePermissions("device:read")
  listTickets(
    @Param("tenantId") tenantId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.supportService.listTickets(tenantId, request.user);
  }

  @Post("support/tickets")
  @RequirePermissions("device:read")
  createTicket(
    @Param("tenantId") tenantId: string,
    @Body() body: CreateSupportTicketDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.supportService.createTicket(tenantId, body, request.user);
  }

  @Patch("support/tickets/:ticketId")
  @RequirePermissions("device:read")
  updateTicket(
    @Param("tenantId") tenantId: string,
    @Param("ticketId") ticketId: string,
    @Body() body: UpdateSupportTicketDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.supportService.updateTicket(
      tenantId,
      ticketId,
      body,
      request.user,
    );
  }

  @Post("support/tickets/:ticketId/notes")
  @RequirePermissions("device:read")
  addTicketNote(
    @Param("tenantId") tenantId: string,
    @Param("ticketId") ticketId: string,
    @Body() body: CreateTicketNoteDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.supportService.addTicketNote(
      tenantId,
      ticketId,
      body,
      request.user,
    );
  }

  @Get("support/devices/:deviceId/notes")
  @RequirePermissions("device:read")
  @ApiOkResponse({ description: "Device support notes" })
  listDeviceSupportNotes(
    @Param("tenantId") tenantId: string,
    @Param("deviceId") deviceId: string,
  ): Promise<SupportNoteSummary[]> {
    return this.supportService.listDeviceSupportNotes(tenantId, deviceId);
  }

  @Post("support/devices/:deviceId/notes")
  @RequirePermissions("device:command")
  @ApiCreatedResponse({ description: "Create a device support note" })
  createDeviceSupportNote(
    @Param("tenantId") tenantId: string,
    @Param("deviceId") deviceId: string,
    @Body() body: CreateSupportNoteDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<SupportNoteSummary> {
    return this.supportService.createDeviceSupportNote(
      tenantId,
      deviceId,
      body,
      {
        email: request.user?.email,
        subject: request.user?.subject,
      },
    );
  }

  @Patch("support/notes/:noteId")
  @RequirePermissions("device:command")
  @ApiOkResponse({ description: "Update a support note" })
  updateSupportNote(
    @Param("tenantId") tenantId: string,
    @Param("noteId") noteId: string,
    @Body() body: UpdateSupportNoteDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<SupportNoteSummary> {
    return this.supportService.updateSupportNote(
      tenantId,
      noteId,
      body,
      request.user?.subject,
    );
  }

  @Get("support/devices/:deviceId/timeline")
  @RequirePermissions("device:read")
  @ApiOkResponse({ description: "Device support timeline" })
  getDeviceSupportTimeline(
    @Param("tenantId") tenantId: string,
    @Param("deviceId") deviceId: string,
    @Query("limit") limit?: string,
  ): Promise<SupportTimelineEvent[]> {
    return this.supportService.getDeviceSupportTimeline(
      tenantId,
      deviceId,
      limit ? Number(limit) : undefined,
    );
  }

  @Get("retention-settings")
  @RequirePermissions("tenant:read")
  @ApiOkResponse({ description: "Tenant retention settings" })
  getRetentionSettings(
    @Param("tenantId") tenantId: string,
  ): Promise<RetentionSettingsSummary> {
    return this.supportService.getRetentionSettings(tenantId);
  }

  @Patch("retention-settings")
  @RequirePermissions("tenant:update")
  @ApiOkResponse({ description: "Update tenant retention settings" })
  updateRetentionSettings(
    @Param("tenantId") tenantId: string,
    @Body() body: UpdateRetentionSettingsDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<RetentionSettingsSummary> {
    return this.supportService.updateRetentionSettings(
      tenantId,
      body,
      request.user?.subject,
    );
  }

  @Post("retention-runs/dry-run")
  @RequirePermissions("tenant:update")
  @ApiCreatedResponse({ description: "Preview retention cleanup counts" })
  dryRunRetention(
    @Param("tenantId") tenantId: string,
    @Body() body: RunRetentionDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<RetentionRunSummary> {
    return this.supportService.dryRunRetention(
      tenantId,
      body,
      request.user?.subject,
    );
  }

  @Post("retention-runs")
  @RequirePermissions("tenant:update")
  @ApiCreatedResponse({ description: "Apply tenant retention cleanup" })
  applyRetention(
    @Param("tenantId") tenantId: string,
    @Body() body: RunRetentionDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<RetentionRunSummary> {
    return this.supportService.applyRetention(
      tenantId,
      body,
      request.user?.subject,
    );
  }
}

import {
  Body,
  Controller,
  Get,
  Header,
  Inject,
  Param,
  Post,
  Put,
  Query,
  Req,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator";
import type { AuthenticatedRequest } from "../auth/types/authenticated-request";
import {
  AcceptPrivacyNoticeDto,
  CreateComplianceEvidencePackDto,
  CreateDataSubjectRequestDto,
  DecideDataSubjectRequestDto,
  CreateDataLegalHoldDto,
  ReleaseDataLegalHoldDto,
  PublishPrivacyNoticeDto,
  RevokePrivacyAcceptanceDto,
  UpdateSecurityPrivacyProfileDto,
  CreateSecurityIncidentDto,
  AddSecurityIncidentUpdateDto,
  CloseSecurityIncidentDto,
  PublishServiceIncidentDto,
  PublishMaintenanceWindowDto,
  PublishDisasterRecoveryEvidenceDto,
} from "./dto/privacy.dto";
import { PrivacyService } from "./privacy.service";

@ApiTags("privacy")
@Controller("tenants/:tenantId/privacy")
export class PrivacyController {
  constructor(
    @Inject(PrivacyService) private readonly service: PrivacyService,
  ) {}
  @Get("service-status")
  @RequirePermissions("audit:read")
  serviceStatus(@Param("tenantId") tenantId: string) {
    return this.service.serviceStatus(tenantId);
  }
  @Post("service-status/incidents")
  @RequirePermissions("tenant:update")
  publishServiceIncident(
    @Param("tenantId") tenantId: string,
    @Body() body: PublishServiceIncidentDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.publishServiceIncident(
      tenantId,
      body,
      req.user?.subject,
    );
  }
  @Post("service-status/maintenance")
  @RequirePermissions("tenant:update")
  publishMaintenance(
    @Param("tenantId") tenantId: string,
    @Body() body: PublishMaintenanceWindowDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.publishMaintenance(tenantId, body, req.user?.subject);
  }
  @Post("service-status/disaster-recovery")
  @RequirePermissions("tenant:update")
  publishDisasterRecovery(
    @Param("tenantId") tenantId: string,
    @Body() body: PublishDisasterRecoveryEvidenceDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.publishDisasterRecovery(
      tenantId,
      body,
      req.user?.subject,
    );
  }
  @Get("security-incidents")
  @RequirePermissions("audit:read")
  listSecurityIncidents(@Param("tenantId") tenantId: string) {
    return this.service.listSecurityIncidents(tenantId);
  }
  @Post("security-incidents")
  @RequirePermissions("audit:read")
  createSecurityIncident(
    @Param("tenantId") tenantId: string,
    @Body() body: CreateSecurityIncidentDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.createSecurityIncident(
      tenantId,
      body,
      req.user?.subject,
    );
  }
  @Post("security-incidents/:incidentId/timeline")
  @RequirePermissions("audit:read")
  addSecurityIncidentUpdate(
    @Param("tenantId") tenantId: string,
    @Param("incidentId") incidentId: string,
    @Body() body: AddSecurityIncidentUpdateDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.addSecurityIncidentUpdate(
      tenantId,
      incidentId,
      body,
      req.user?.subject,
    );
  }
  @Post("security-incidents/:incidentId/close")
  @RequirePermissions("audit:read")
  closeSecurityIncident(
    @Param("tenantId") tenantId: string,
    @Param("incidentId") incidentId: string,
    @Body() body: CloseSecurityIncidentDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.closeSecurityIncident(
      tenantId,
      incidentId,
      body.closureSummary,
      req.user?.subject,
    );
  }
  @Get("security-incidents/:incidentId/export")
  @RequirePermissions("audit:read")
  @Header("Content-Type", "application/json; charset=utf-8")
  @Header(
    "Content-Disposition",
    'attachment; filename="security-incident.json"',
  )
  exportSecurityIncident(
    @Param("tenantId") tenantId: string,
    @Param("incidentId") incidentId: string,
  ) {
    return this.service.exportSecurityIncident(tenantId, incidentId);
  }
  @Get("legal-holds") @RequirePermissions("audit:read") listLegalHolds(
    @Param("tenantId") tenantId: string,
  ) {
    return this.service.listLegalHolds(tenantId);
  }
  @Post("legal-holds") @RequirePermissions("tenant:update") createLegalHold(
    @Param("tenantId") tenantId: string,
    @Body() body: CreateDataLegalHoldDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.createLegalHold(tenantId, body, req.user?.subject);
  }
  @Post("legal-holds/:holdId/release")
  @RequirePermissions("tenant:update")
  releaseLegalHold(
    @Param("tenantId") tenantId: string,
    @Param("holdId") holdId: string,
    @Body() body: ReleaseDataLegalHoldDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.releaseLegalHold(
      tenantId,
      holdId,
      body.reason,
      req.user?.subject,
    );
  }
  @Get("data-subject-requests")
  @RequirePermissions("audit:read")
  listDataSubjectRequests(@Param("tenantId") tenantId: string) {
    return this.service.listDataSubjectRequests(tenantId);
  }
  @Post("data-subject-requests")
  @RequirePermissions("audit:read")
  createDataSubjectRequest(
    @Param("tenantId") tenantId: string,
    @Body() body: CreateDataSubjectRequestDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.createDataSubjectRequest(
      tenantId,
      body,
      req.user?.subject,
    );
  }
  @Post("data-subject-requests/:requestId/decision")
  @RequirePermissions("tenant:update")
  decideDataSubjectRequest(
    @Param("tenantId") tenantId: string,
    @Param("requestId") requestId: string,
    @Body() body: DecideDataSubjectRequestDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.decideDataSubjectRequest(
      tenantId,
      requestId,
      body,
      req.user?.subject,
    );
  }
  @Get("data-subject-requests/:requestId/download")
  @RequirePermissions("audit:read")
  @Header("Content-Type", "application/json; charset=utf-8")
  downloadDataSubjectExport(
    @Param("tenantId") tenantId: string,
    @Param("requestId") requestId: string,
  ) {
    return this.service.downloadDataSubjectExport(tenantId, requestId);
  }
  @Get("evidence-packs") @RequirePermissions("audit:read") listEvidencePacks(
    @Param("tenantId") tenantId: string,
  ) {
    return this.service.listEvidencePacks(tenantId);
  }
  @Post("evidence-packs") @RequirePermissions("audit:read") createEvidencePack(
    @Param("tenantId") tenantId: string,
    @Body() body: CreateComplianceEvidencePackDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.createEvidencePack(tenantId, body, req.user?.subject);
  }
  @Get("evidence-packs/:packId/download")
  @RequirePermissions("audit:read")
  @Header("Content-Type", "application/json; charset=utf-8")
  @Header(
    "Content-Disposition",
    'attachment; filename="compliance-evidence-pack.json"',
  )
  downloadEvidencePack(
    @Param("tenantId") tenantId: string,
    @Param("packId") packId: string,
  ) {
    return this.service.downloadEvidencePack(tenantId, packId);
  }
  @Get("security-center") @RequirePermissions("audit:read") overview(
    @Param("tenantId") tenantId: string,
  ) {
    return this.service.securityCenter(tenantId);
  }
  @Put("security-center/profile")
  @RequirePermissions("tenant:update")
  updateProfile(
    @Param("tenantId") tenantId: string,
    @Body() body: UpdateSecurityPrivacyProfileDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.updateSecurityPrivacyProfile(
      tenantId,
      body,
      req.user?.subject,
    );
  }
  @Post("notices") @RequirePermissions("tenant:update") publish(
    @Param("tenantId") tenantId: string,
    @Body() body: PublishPrivacyNoticeDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.publish(tenantId, body, req.user?.subject);
  }
  @Get("notices") listNotices(
    @Param("tenantId") tenantId: string,
    @Query("noticeType") noticeType?: string,
  ) {
    return this.service.listNotices(tenantId, noticeType);
  }
  @Post("notices/:noticeId/accept") accept(
    @Param("tenantId") tenantId: string,
    @Param("noticeId") noticeId: string,
    @Body() body: AcceptPrivacyNoticeDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.accept(
      tenantId,
      noticeId,
      body,
      req.user?.subject,
      req.user?.role,
    );
  }
  @Post("acceptances/:acceptanceId/revoke") revoke(
    @Param("tenantId") tenantId: string,
    @Param("acceptanceId") acceptanceId: string,
    @Body() body: RevokePrivacyAcceptanceDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.revoke(
      tenantId,
      acceptanceId,
      body.reason,
      req.user?.subject,
    );
  }
  @Get("acceptances") @RequirePermissions("tenant:update") listAcceptances(
    @Param("tenantId") tenantId: string,
  ) {
    return this.service.listAcceptances(tenantId);
  }
}

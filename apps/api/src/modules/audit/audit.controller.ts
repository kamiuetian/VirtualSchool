import { Controller, Get, Inject, Param, Query } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type { AuditEventList } from "@virtual-school/shared";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator";
import { AuditService } from "./audit.service";
import { ListAuditEventsDto } from "./dto/list-audit-events.dto";

@ApiTags("audit")
@Controller("tenants/:tenantId/audit-events")
export class AuditController {
  constructor(
    @Inject(AuditService) private readonly auditService: AuditService,
  ) {}

  @Get()
  @RequirePermissions("audit:read")
  @ApiOkResponse({ description: "Tenant-scoped audit event search" })
  listAuditEvents(
    @Param("tenantId") tenantId: string,
    @Query() query: ListAuditEventsDto,
  ): Promise<AuditEventList> {
    return this.auditService.listAuditEvents(tenantId, query);
  }
}

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
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator";
import type { AuthenticatedRequest } from "../auth/types/authenticated-request";
import {
  CreateContentLibraryItemDto,
  UpdateContentLibraryItemDto,
} from "./content-library.dto";
import { ContentLibraryService } from "./content-library.service";

@Controller("tenants/:tenantId/content-library")
export class ContentLibraryController {
  constructor(
    @Inject(ContentLibraryService)
    private readonly service: ContentLibraryService,
  ) {}
  @Get() @RequirePermissions("tenant:read") list(
    @Param("tenantId") tenantId: string,
    @Query("includeUnavailable") value?: string,
  ) {
    return this.service.list(tenantId, value === "true");
  }
  @Get("report") @RequirePermissions("report:export") report(
    @Param("tenantId") tenantId: string,
  ) {
    return this.service.report(tenantId);
  }
  @Post() @RequirePermissions("policy:manage") create(
    @Param("tenantId") tenantId: string,
    @Body() body: CreateContentLibraryItemDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.create(tenantId, body, req.user?.subject);
  }
  @Patch(":itemId") @RequirePermissions("policy:manage") update(
    @Param("tenantId") tenantId: string,
    @Param("itemId") itemId: string,
    @Body() body: UpdateContentLibraryItemDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.update(tenantId, itemId, body, req.user?.subject);
  }
}

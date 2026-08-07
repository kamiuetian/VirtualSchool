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
  BranchSummary,
  OnboardingChecklist,
  TenantSummary,
} from "@virtual-school/shared";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator";
import type { AuthenticatedRequest } from "../auth/types/authenticated-request";
import { CreateBranchDto } from "./dto/create-branch.dto";
import { CreateTenantDto } from "./dto/create-tenant.dto";
import { UpdateTenantProfileDto } from "./dto/update-tenant-profile.dto";
import { TenantsService } from "./tenants.service";

@ApiTags("tenants")
@Controller("tenants")
export class TenantsController {
  constructor(
    @Inject(TenantsService) private readonly tenantsService: TenantsService,
  ) {}

  @Get()
  @RequirePermissions("tenant:read")
  @ApiOkResponse({
    description: "Tenant list scoped to authorized platform/school access",
  })
  list(@Req() request: AuthenticatedRequest): Promise<TenantSummary[]> {
    return this.tenantsService.listAuthorized(request.user?.tenantIds ?? []);
  }

  @Get(":tenantId")
  @RequirePermissions("tenant:read")
  @ApiOkResponse({ description: "Tenant details" })
  getById(@Param("tenantId") tenantId: string): Promise<TenantSummary> {
    return this.tenantsService.getById(tenantId);
  }

  @Patch(":tenantId")
  @RequirePermissions("tenant:update")
  @ApiOkResponse({ description: "Update tenant school profile and branding" })
  updateProfile(
    @Param("tenantId") tenantId: string,
    @Body() body: UpdateTenantProfileDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<TenantSummary> {
    return this.tenantsService.updateProfile(
      tenantId,
      body,
      request.user?.subject,
    );
  }

  @Get(":tenantId/branches")
  @RequirePermissions("tenant:read")
  @ApiOkResponse({ description: "Tenant branch/campus list" })
  listBranches(@Param("tenantId") tenantId: string): Promise<BranchSummary[]> {
    return this.tenantsService.listBranches(tenantId);
  }

  @Post(":tenantId/branches")
  @RequirePermissions("tenant:update")
  @ApiCreatedResponse({ description: "Create a tenant branch or campus" })
  createBranch(
    @Param("tenantId") tenantId: string,
    @Body() body: CreateBranchDto,
  ): Promise<BranchSummary> {
    return this.tenantsService.createBranch(tenantId, body);
  }

  @Get(":tenantId/onboarding-checklist")
  @RequirePermissions("tenant:read")
  @ApiOkResponse({
    description: "First-run setup checklist for a school tenant",
  })
  getOnboardingChecklist(
    @Param("tenantId") tenantId: string,
  ): Promise<OnboardingChecklist> {
    return this.tenantsService.getOnboardingChecklist(tenantId);
  }

  @Post(":tenantId/onboarding-checklist/complete")
  @RequirePermissions("tenant:update")
  @ApiOkResponse({
    description: "Persist completion of a ready onboarding checklist",
  })
  completeOnboarding(
    @Param("tenantId") tenantId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<OnboardingChecklist> {
    return this.tenantsService.completeOnboarding(
      tenantId,
      request.user?.subject,
    );
  }

  @Post()
  @RequirePermissions("tenant:create")
  @ApiCreatedResponse({ description: "Create an isolated school tenant" })
  create(@Body() body: CreateTenantDto): Promise<TenantSummary> {
    return this.tenantsService.create(body);
  }
}

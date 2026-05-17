import { Body, Controller, Get, Inject, Param, Post } from "@nestjs/common";
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type { BranchSummary, OnboardingChecklist, TenantSummary } from "@virtual-school/shared";
import { CreateBranchDto } from "./dto/create-branch.dto";
import { CreateTenantDto } from "./dto/create-tenant.dto";
import { TenantsService } from "./tenants.service";

@ApiTags("tenants")
@Controller("tenants")
export class TenantsController {
  constructor(@Inject(TenantsService) private readonly tenantsService: TenantsService) {}

  @Get()
  @ApiOkResponse({ description: "Tenant list scoped to authorized platform/school access" })
  list(): Promise<TenantSummary[]> {
    return this.tenantsService.list();
  }

  @Get(":tenantId")
  @ApiOkResponse({ description: "Tenant details" })
  getById(@Param("tenantId") tenantId: string): Promise<TenantSummary> {
    return this.tenantsService.getById(tenantId);
  }

  @Get(":tenantId/branches")
  @ApiOkResponse({ description: "Tenant branch/campus list" })
  listBranches(@Param("tenantId") tenantId: string): Promise<BranchSummary[]> {
    return this.tenantsService.listBranches(tenantId);
  }

  @Post(":tenantId/branches")
  @ApiCreatedResponse({ description: "Create a tenant branch or campus" })
  createBranch(
    @Param("tenantId") tenantId: string,
    @Body() body: CreateBranchDto
  ): Promise<BranchSummary> {
    return this.tenantsService.createBranch(tenantId, body);
  }

  @Get(":tenantId/onboarding-checklist")
  @ApiOkResponse({ description: "First-run setup checklist for a school tenant" })
  getOnboardingChecklist(@Param("tenantId") tenantId: string): Promise<OnboardingChecklist> {
    return this.tenantsService.getOnboardingChecklist(tenantId);
  }

  @Post()
  @ApiCreatedResponse({ description: "Create an isolated school tenant" })
  create(@Body() body: CreateTenantDto): Promise<TenantSummary> {
    return this.tenantsService.create(body);
  }
}

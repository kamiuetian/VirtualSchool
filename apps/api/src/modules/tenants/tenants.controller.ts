import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type { TenantSummary } from "@virtual-school/shared";
import { CreateTenantDto } from "./dto/create-tenant.dto";
import { TenantsService } from "./tenants.service";

@ApiTags("tenants")
@Controller("tenants")
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

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

  @Post()
  @ApiCreatedResponse({ description: "Create an isolated school tenant" })
  create(@Body() body: CreateTenantDto): Promise<TenantSummary> {
    return this.tenantsService.create(body);
  }
}

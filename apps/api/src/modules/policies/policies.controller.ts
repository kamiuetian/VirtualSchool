import { Body, Controller, Get, Inject, Param, Post } from "@nestjs/common";
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type {
  PolicySummary,
  PolicyVersionSummary,
} from "@virtual-school/shared";
import { CreatePolicyDto } from "./dto/create-policy.dto";
import { PublishPolicyDto } from "./dto/publish-policy.dto";
import { PoliciesService } from "./policies.service";

@ApiTags("policies")
@Controller("tenants/:tenantId/policies")
export class PoliciesController {
  constructor(
    @Inject(PoliciesService) private readonly policiesService: PoliciesService,
  ) {}

  @Get()
  @ApiOkResponse({ description: "Tenant policy templates and custom policies" })
  listPolicies(@Param("tenantId") tenantId: string): Promise<PolicySummary[]> {
    return this.policiesService.listPolicies(tenantId);
  }

  @Post()
  @ApiCreatedResponse({ description: "Create a versioned policy" })
  createPolicy(
    @Param("tenantId") tenantId: string,
    @Body() body: CreatePolicyDto,
  ): Promise<PolicySummary> {
    return this.policiesService.createPolicy(tenantId, body);
  }

  @Post("starter-templates")
  @ApiCreatedResponse({
    description: "Create missing Phase 1 starter policy templates",
  })
  createStarterTemplates(
    @Param("tenantId") tenantId: string,
  ): Promise<PolicySummary[]> {
    return this.policiesService.createStarterTemplates(tenantId);
  }

  @Post(":policyId/publish")
  @ApiOkResponse({
    description: "Publish a policy and write a new version snapshot",
  })
  publishPolicy(
    @Param("tenantId") tenantId: string,
    @Param("policyId") policyId: string,
    @Body() body: PublishPolicyDto,
  ): Promise<PolicySummary> {
    return this.policiesService.publishPolicy(tenantId, policyId, body);
  }

  @Get(":policyId/versions")
  @ApiOkResponse({ description: "Policy version history" })
  listPolicyVersions(
    @Param("tenantId") tenantId: string,
    @Param("policyId") policyId: string,
  ): Promise<PolicyVersionSummary[]> {
    return this.policiesService.listPolicyVersions(tenantId, policyId);
  }
}

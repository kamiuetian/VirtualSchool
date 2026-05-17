import { Body, Controller, Get, Inject, Param, Post } from "@nestjs/common";
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type {
  ActivePolicyResolution,
  DevicePolicyPayload,
  PolicyAssignmentSummary,
  PolicyPublishSummary,
  PolicySummary,
  PolicyVersionSummary,
} from "@virtual-school/shared";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator";
import { AssignPolicyDto } from "./dto/assign-policy.dto";
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
  @RequirePermissions("tenant:read")
  @ApiOkResponse({ description: "Tenant policy templates and custom policies" })
  listPolicies(@Param("tenantId") tenantId: string): Promise<PolicySummary[]> {
    return this.policiesService.listPolicies(tenantId);
  }

  @Get("assignments")
  @RequirePermissions("tenant:read")
  @ApiOkResponse({ description: "Tenant policy assignment list" })
  listPolicyAssignments(
    @Param("tenantId") tenantId: string,
  ): Promise<PolicyAssignmentSummary[]> {
    return this.policiesService.listPolicyAssignments(tenantId);
  }

  @Get("devices/:deviceId/active")
  @RequirePermissions("device:read")
  @ApiOkResponse({
    description:
      "Resolve the active policy for a device with a precedence explanation",
  })
  resolveActivePolicyForDevice(
    @Param("tenantId") tenantId: string,
    @Param("deviceId") deviceId: string,
  ): Promise<ActivePolicyResolution> {
    return this.policiesService.resolveActivePolicyForDevice(
      tenantId,
      deviceId,
    );
  }

  @Get("devices/:deviceId/payload")
  @RequirePermissions("device:read")
  @ApiOkResponse({
    description:
      "Return the active launcher and browser policy payload for a managed Android device",
  })
  getDevicePolicyPayload(
    @Param("tenantId") tenantId: string,
    @Param("deviceId") deviceId: string,
  ): Promise<DevicePolicyPayload> {
    return this.policiesService.getDevicePolicyPayload(tenantId, deviceId);
  }

  @Post()
  @RequirePermissions("policy:manage")
  @ApiCreatedResponse({ description: "Create a versioned policy" })
  createPolicy(
    @Param("tenantId") tenantId: string,
    @Body() body: CreatePolicyDto,
  ): Promise<PolicySummary> {
    return this.policiesService.createPolicy(tenantId, body);
  }

  @Post("starter-templates")
  @RequirePermissions("policy:manage")
  @ApiCreatedResponse({
    description: "Create missing Phase 1 starter policy templates",
  })
  createStarterTemplates(
    @Param("tenantId") tenantId: string,
  ): Promise<PolicySummary[]> {
    return this.policiesService.createStarterTemplates(tenantId);
  }

  @Post(":policyId/publish")
  @RequirePermissions("policy:manage")
  @ApiOkResponse({
    description: "Publish a policy and write a new version snapshot",
  })
  publishPolicy(
    @Param("tenantId") tenantId: string,
    @Param("policyId") policyId: string,
    @Body() body: PublishPolicyDto,
  ): Promise<PolicyPublishSummary> {
    return this.policiesService.publishPolicy(tenantId, policyId, body);
  }

  @Post(":policyId/assignments")
  @RequirePermissions("policy:manage")
  @ApiCreatedResponse({
    description:
      "Assign a published policy to a tenant, grade, class, student, or device",
  })
  assignPolicy(
    @Param("tenantId") tenantId: string,
    @Param("policyId") policyId: string,
    @Body() body: AssignPolicyDto,
  ): Promise<PolicyAssignmentSummary> {
    return this.policiesService.assignPolicy(tenantId, policyId, body);
  }

  @Get(":policyId/versions")
  @RequirePermissions("tenant:read")
  @ApiOkResponse({ description: "Policy version history" })
  listPolicyVersions(
    @Param("tenantId") tenantId: string,
    @Param("policyId") policyId: string,
  ): Promise<PolicyVersionSummary[]> {
    return this.policiesService.listPolicyVersions(tenantId, policyId);
  }
}

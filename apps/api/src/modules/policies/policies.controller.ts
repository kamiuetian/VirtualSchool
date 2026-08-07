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
  ActivePolicyResolution,
  DevicePolicyPayload,
  PolicyAssignmentSummary,
  PolicyPublishSummary,
  PolicySummary,
  PolicyVersionSummary,
  UrlPolicySimulation,
  BlockedDomainAggregate,
} from "@virtual-school/shared";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator";
import { AssignPolicyDto } from "./dto/assign-policy.dto";
import { CreatePolicyDto } from "./dto/create-policy.dto";
import { IssueSupportUnlockDto } from "./dto/issue-support-unlock.dto";
import { PublishPolicyDto } from "./dto/publish-policy.dto";
import { RollbackPolicyDto } from "./dto/rollback-policy.dto";
import { UpdateAndroidControlsDto } from "./dto/update-android-controls.dto";
import { SimulateUrlPolicyDto } from "./dto/simulate-url-policy.dto";
import { IngestBlockedDomainEventDto } from "./dto/ingest-blocked-domain-event.dto";
import { PoliciesService } from "./policies.service";
import type { AuthenticatedRequest } from "../auth/types/authenticated-request";
import { CompleteExamDto, ScheduleExamDto } from "./dto/schedule-exam.dto";

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

  @Post("events/blocked-domains")
  @RequirePermissions("device:read")
  @ApiCreatedResponse({
    description: "Ingest a privacy-limited blocked-domain event",
  })
  ingestBlockedDomainEvent(
    @Param("tenantId") tenantId: string,
    @Body() body: IngestBlockedDomainEventDto,
  ): Promise<{ id: string }> {
    return this.policiesService.ingestBlockedDomainEvent(tenantId, body);
  }

  @Get("events/blocked-domains/aggregates")
  @RequirePermissions("policy:manage")
  @ApiOkResponse({
    description: "Blocked domains aggregated for the last 30 days",
  })
  listBlockedDomainAggregates(
    @Param("tenantId") tenantId: string,
  ): Promise<BlockedDomainAggregate[]> {
    return this.policiesService.listBlockedDomainAggregates(tenantId);
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

  @Patch(":policyId/android-controls")
  @RequirePermissions("policy:manage")
  @ApiOkResponse({ description: "Validate and update Android policy controls" })
  updateAndroidControls(
    @Param("tenantId") tenantId: string,
    @Param("policyId") policyId: string,
    @Body() body: UpdateAndroidControlsDto,
  ): Promise<PolicySummary> {
    return this.policiesService.updateAndroidControls(tenantId, policyId, body);
  }

  @Post(":policyId/simulate-url")
  @RequirePermissions("policy:manage")
  @ApiOkResponse({
    description: "Simulate URL rules without recording browsing data",
  })
  simulateUrlPolicy(
    @Param("tenantId") tenantId: string,
    @Param("policyId") policyId: string,
    @Body() body: SimulateUrlPolicyDto,
  ): Promise<UrlPolicySimulation> {
    return this.policiesService.simulateUrlPolicy(tenantId, policyId, body.url);
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

  @Post(":policyId/rollback")
  @RequirePermissions("policy:manage")
  @ApiOkResponse({
    description: "Republish a prior snapshot as a new policy version",
  })
  rollbackPolicy(
    @Param("tenantId") tenantId: string,
    @Param("policyId") policyId: string,
    @Body() body: RollbackPolicyDto,
  ): Promise<PolicyPublishSummary> {
    return this.policiesService.rollbackPolicy(tenantId, policyId, body);
  }

  @Post("support-unlocks")
  @RequirePermissions("policy:manage")
  @ApiCreatedResponse({ description: "Issue a bounded device support unlock" })
  issueSupportUnlock(
    @Param("tenantId") tenantId: string,
    @Body() body: IssueSupportUnlockDto,
  ): Promise<PolicyAssignmentSummary> {
    return this.policiesService.issueSupportUnlock(tenantId, body);
  }

  @Post("exam-schedules")
  @RequirePermissions("policy:manage")
  @ApiCreatedResponse({ description: "Schedule Exam Mode for a class, grade, or student" })
  scheduleExam(
    @Param("tenantId") tenantId: string,
    @Body() body: ScheduleExamDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<PolicyAssignmentSummary> {
    return this.policiesService.scheduleExam(tenantId, body, request.user!.subject);
  }

  @Post("exam-schedules/:assignmentId/complete")
  @RequirePermissions("policy:manage")
  @ApiOkResponse({ description: "Complete an exam and release Exam Mode immediately" })
  completeExam(
    @Param("tenantId") tenantId: string,
    @Param("assignmentId") assignmentId: string,
    @Body() body: CompleteExamDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<PolicyAssignmentSummary> {
    return this.policiesService.completeExam(tenantId, assignmentId, body.reason, request.user!.subject);
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

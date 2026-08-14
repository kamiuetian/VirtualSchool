import { Injectable } from "@nestjs/common";
import type {
  MdmCommandDispatchInput,
  MdmCommandDispatchResult,
  MdmConnector,
  MdmEnrollmentTokenCreateInput,
  MdmEnrollmentTokenCreateResult,
  MdmEnrollmentTokenDeleteInput,
  MdmEnrollmentTokenDeleteResult,
  MdmPolicyPublishInput,
  MdmPolicyPublishResult,
} from "./mdm-connector.types";

@Injectable()
export class StubMdmConnector implements MdmConnector {
  readonly key = "STUB" as const;

  async createEnrollmentToken(
    input: MdmEnrollmentTokenCreateInput,
  ): Promise<MdmEnrollmentTokenCreateResult> {
    return {
      accepted: false,
      connector: this.key,
      failureReason: `Stub enrollment is unavailable for batch ${input.batchId}`,
      retryable: false,
    };
  }

  async deleteEnrollmentToken(
    input: MdmEnrollmentTokenDeleteInput,
  ): Promise<MdmEnrollmentTokenDeleteResult> {
    return {
      accepted: false,
      connector: this.key,
      failureReason: "Stub enrollment tokens cannot be revoked",
      retryable: false,
      tokenName: input.tokenName,
    };
  }

  async dispatchCommand(
    input: MdmCommandDispatchInput,
  ): Promise<MdmCommandDispatchResult> {
    return {
      accepted: true,
      connector: this.key,
      connectorCommandId: `stub:${input.command.id}`,
      operationName: `stub:${input.command.id}`,
      request: {
        commandId: input.command.id,
        deviceId: input.device.id,
        type: input.command.type,
      },
      response: {
        acceptedAt: new Date().toISOString(),
        mode: "stub",
      },
    };
  }

  async publishPolicy(
    input: MdmPolicyPublishInput,
  ): Promise<MdmPolicyPublishResult> {
    const mdmPolicyName = `stub/policies/${input.tenantId}/${input.policy.id}`;

    return {
      accepted: true,
      connector: this.key,
      mdmPolicyName,
      request: {
        appCount: input.apps.length,
        mode: input.policy.rules.mode,
        policyId: input.policy.id,
        policyVersion: input.policy.version,
      },
      response: {
        acceptedAt: new Date().toISOString(),
        mdmPolicyName,
        mode: "stub",
      },
    };
  }
}

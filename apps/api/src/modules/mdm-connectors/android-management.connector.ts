import { Inject, Injectable } from "@nestjs/common";
import { GoogleAuth } from "google-auth-library";
import { AndroidManagementCommandMapper } from "./android-management-command.mapper";
import { AndroidManagementPolicyMapper } from "./android-management-policy.mapper";
import type {
  MdmCommandDispatchInput,
  MdmCommandDispatchResult,
  MdmConnector,
  MdmPolicyPublishInput,
  MdmPolicyPublishResult,
} from "./mdm-connector.types";

type AndroidOperation = {
  name?: string;
  metadata?: Record<string, unknown>;
  done?: boolean;
  error?: Record<string, unknown>;
  response?: Record<string, unknown>;
};

const androidManagementScope =
  "https://www.googleapis.com/auth/androidmanagement";

@Injectable()
export class AndroidManagementConnector implements MdmConnector {
  readonly key = "ANDROID_MANAGEMENT_API" as const;
  private readonly auth = new GoogleAuth({
    scopes: [androidManagementScope],
  });

  constructor(
    @Inject(AndroidManagementCommandMapper)
    private readonly commandMapper: AndroidManagementCommandMapper,
    @Inject(AndroidManagementPolicyMapper)
    private readonly policyMapper: AndroidManagementPolicyMapper,
  ) {}

  async dispatchCommand(
    input: MdmCommandDispatchInput,
  ): Promise<MdmCommandDispatchResult> {
    const deviceName = this.resolveDeviceName(input);

    if (!deviceName) {
      return {
        accepted: false,
        connector: this.key,
        failureReason:
          "Device is missing Android Management API resource identity",
        retryable: false,
      };
    }

    const ttlSeconds = input.command.expiresAt
      ? Math.max(
          Math.ceil((input.command.expiresAt.getTime() - Date.now()) / 1000),
          1,
        )
      : undefined;
    const mapping = this.commandMapper.map({
      payload: input.command.payload,
      reason: input.command.reason,
      ttlSeconds,
      type: input.command.type,
    });

    if (!mapping.supported) {
      return {
        accepted: false,
        connector: this.key,
        failureReason: mapping.failureReason,
        retryable: false,
      };
    }

    const client = await this.auth.getClient();
    const baseUrl =
      process.env.ANDROID_MANAGEMENT_API_BASE_URL ??
      "https://androidmanagement.googleapis.com";
    const response = await client.request<AndroidOperation>({
      data: mapping.command,
      method: "POST",
      url: `${baseUrl}/v1/${deviceName}:issueCommand`,
    });
    const operation = response.data;

    return {
      accepted: true,
      connector: this.key,
      connectorCommandId: operation.name,
      operationName: operation.name,
      request: mapping.command,
      response: operation as Record<string, unknown>,
    };
  }

  async publishPolicy(
    input: MdmPolicyPublishInput,
  ): Promise<MdmPolicyPublishResult> {
    const enterpriseId =
      process.env.ANDROID_MANAGEMENT_ENTERPRISE_ID ??
      process.env.ANDROID_ENTERPRISE_ID;

    if (!enterpriseId) {
      return {
        accepted: false,
        connector: this.key,
        failureReason:
          "ANDROID_MANAGEMENT_ENTERPRISE_ID is required to publish policies",
        retryable: false,
      };
    }

    const payload = this.policyMapper.map({
      apps: input.apps.map((app) => ({
        installRules: app.installRules,
        name: app.name,
        packageId: app.packageId,
      })),
      enterpriseId,
      offlineResources: input.offlineResources,
      policyId: input.policy.id,
      rules: input.policy.rules,
      tenantId: input.tenantId,
      version: input.policy.version,
    });
    const client = await this.auth.getClient();
    const baseUrl =
      process.env.ANDROID_MANAGEMENT_API_BASE_URL ??
      "https://androidmanagement.googleapis.com";
    const response = await client.request<Record<string, unknown>>({
      data: payload,
      method: "PATCH",
      url: `${baseUrl}/v1/${payload.name}`,
    });

    return {
      accepted: true,
      connector: this.key,
      mdmPolicyName: payload.name,
      request: payload,
      response: response.data,
    };
  }

  private resolveDeviceName(
    input: MdmCommandDispatchInput,
  ): string | undefined {
    if (input.device.connectorDeviceName) {
      return input.device.connectorDeviceName;
    }

    const enterpriseId =
      process.env.ANDROID_MANAGEMENT_ENTERPRISE_ID ??
      process.env.ANDROID_ENTERPRISE_ID;

    if (!enterpriseId || !input.device.enrollmentId) {
      return undefined;
    }

    return `enterprises/${enterpriseId}/devices/${input.device.enrollmentId}`;
  }
}

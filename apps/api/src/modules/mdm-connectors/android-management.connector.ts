import { Inject, Injectable } from "@nestjs/common";
import { GoogleAuth } from "google-auth-library";
import { AndroidManagementCommandMapper } from "./android-management-command.mapper";
import { AndroidManagementPolicyMapper } from "./android-management-policy.mapper";
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

type AndroidOperation = {
  name?: string;
  metadata?: Record<string, unknown>;
  done?: boolean;
  error?: Record<string, unknown>;
  response?: Record<string, unknown>;
};

type AndroidEnrollmentToken = {
  name?: string;
  value?: string;
  qrCode?: string;
  expirationTimestamp?: string;
  policyName?: string;
  [key: string]: unknown;
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

  async createEnrollmentToken(
    input: MdmEnrollmentTokenCreateInput,
  ): Promise<MdmEnrollmentTokenCreateResult> {
    const enterpriseName = this.enterpriseName();

    if (!enterpriseName) {
      return {
        accepted: false,
        connector: this.key,
        failureReason:
          "ANDROID_MANAGEMENT_ENTERPRISE_ID is required to create enrollment tokens",
        retryable: false,
      };
    }

    const client = await this.auth.getClient();
    const baseUrl = this.baseUrl();
    const defaultPolicyName = `${enterpriseName}/policies/default`;
    const policyName = input.policyName ?? defaultPolicyName;

    if (policyName === defaultPolicyName) {
      await this.ensureDefaultEnrollmentPolicy(
        client,
        baseUrl,
        defaultPolicyName,
      );
    }

    const durationSeconds = this.enrollmentDurationSeconds(input.expiresAt);
    const request = {
      additionalData: JSON.stringify({
        batchId: input.batchId,
        tenantId: input.tenantId,
      }),
      allowPersonalUsage: "PERSONAL_USAGE_DISALLOWED_USERLESS",
      duration: `${durationSeconds}s`,
      oneTimeOnly: input.maxDevices === 1,
      policyName,
    };
    const response = await client.request<AndroidEnrollmentToken>({
      data: request,
      method: "POST",
      url: `${baseUrl}/v1/${enterpriseName}/enrollmentTokens`,
    });
    const token = response.data;

    if (
      !token.name ||
      !token.value ||
      !token.qrCode ||
      !token.expirationTimestamp
    ) {
      return {
        accepted: false,
        connector: this.key,
        enterpriseName,
        failureReason:
          "Android Management API returned an incomplete enrollment token",
        request,
        response: token,
        retryable: false,
      };
    }

    return {
      accepted: true,
      connector: this.key,
      enterpriseName,
      expirationTimestamp: token.expirationTimestamp,
      policyName: token.policyName ?? policyName,
      qrCode: token.qrCode,
      request,
      response: token,
      tokenName: token.name,
      tokenValue: token.value,
    };
  }

  async deleteEnrollmentToken(
    input: MdmEnrollmentTokenDeleteInput,
  ): Promise<MdmEnrollmentTokenDeleteResult> {
    const enterpriseName = this.enterpriseName();

    if (!enterpriseName) {
      return {
        accepted: false,
        connector: this.key,
        failureReason:
          "ANDROID_MANAGEMENT_ENTERPRISE_ID is required to revoke enrollment tokens",
        retryable: false,
        tokenName: input.tokenName,
      };
    }

    if (!input.tokenName.startsWith(`${enterpriseName}/enrollmentTokens/`)) {
      return {
        accepted: false,
        connector: this.key,
        failureReason:
          "Enrollment token does not belong to the configured Android enterprise",
        retryable: false,
        tokenName: input.tokenName,
      };
    }

    const client = await this.auth.getClient();

    try {
      await client.request({
        method: "DELETE",
        url: `${this.baseUrl()}/v1/${input.tokenName}`,
      });
    } catch (error) {
      if (this.responseStatus(error) !== 404) {
        throw error;
      }
    }

    return {
      accepted: true,
      connector: this.key,
      tokenName: input.tokenName,
    };
  }

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
    const baseUrl = this.baseUrl();
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
    const enterpriseId = this.enterpriseId();

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
      language: input.language,
      offlineResources: input.offlineResources,
      policyId: input.policy.id,
      rules: input.policy.rules,
      tenantId: input.tenantId,
      version: input.policy.version,
    });
    const client = await this.auth.getClient();
    const baseUrl = this.baseUrl();
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

    const enterpriseId = this.enterpriseId();

    if (!enterpriseId || !input.device.enrollmentId) {
      return undefined;
    }

    return `enterprises/${enterpriseId}/devices/${input.device.enrollmentId}`;
  }

  private async ensureDefaultEnrollmentPolicy(
    client: Awaited<ReturnType<GoogleAuth["getClient"]>>,
    baseUrl: string,
    policyName: string,
  ): Promise<void> {
    try {
      await client.request({
        method: "GET",
        url: `${baseUrl}/v1/${policyName}`,
      });
      return;
    } catch (error) {
      if (this.responseStatus(error) !== 404) {
        throw error;
      }
    }

    await client.request({
      data: {
        debuggingFeaturesAllowed: false,
        factoryResetDisabled: true,
        installAppsDisabled: true,
        name: policyName,
        safeBootDisabled: true,
        statusReportingSettings: {
          applicationReportsEnabled: true,
          deviceSettingsEnabled: true,
          memoryInfoEnabled: true,
          networkInfoEnabled: true,
          softwareInfoEnabled: true,
        },
      },
      method: "PATCH",
      url: `${baseUrl}/v1/${policyName}`,
    });
  }

  private enrollmentDurationSeconds(expiresAt: Date | undefined): number {
    if (expiresAt) {
      return Math.max(Math.ceil((expiresAt.getTime() - Date.now()) / 1000), 1);
    }

    const configured = Number(
      process.env.ANDROID_ENROLLMENT_TOKEN_TTL_SECONDS ?? 86_400,
    );

    return Number.isInteger(configured) && configured >= 300
      ? configured
      : 86_400;
  }

  private enterpriseId(): string | undefined {
    return (
      process.env.ANDROID_MANAGEMENT_ENTERPRISE_ID ??
      process.env.ANDROID_ENTERPRISE_ID
    );
  }

  private enterpriseName(): string | undefined {
    const enterpriseId = this.enterpriseId();
    return enterpriseId ? `enterprises/${enterpriseId}` : undefined;
  }

  private baseUrl(): string {
    return (
      process.env.ANDROID_MANAGEMENT_API_BASE_URL ??
      "https://androidmanagement.googleapis.com"
    ).replace(/\/$/, "");
  }

  private responseStatus(error: unknown): number | undefined {
    if (typeof error !== "object" || error === null || !("response" in error)) {
      return undefined;
    }

    const response = error.response;
    if (typeof response !== "object" || response === null) {
      return undefined;
    }

    return "status" in response && typeof response.status === "number"
      ? response.status
      : undefined;
  }
}

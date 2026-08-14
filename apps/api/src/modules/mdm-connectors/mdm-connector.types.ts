import type { PolicyRuleSet, RemoteCommandType } from "@virtual-school/shared";
import type { AppCatalogItem, Prisma } from "../../generated/prisma";

export type MdmConnectorKey = "ANDROID_MANAGEMENT_API" | "STUB";

export type MdmDeviceIdentity = {
  id: string;
  tenantId: string;
  enrollmentId?: string | null;
  connectorDeviceName?: string | null;
  mdmConnector: string;
};

export type MdmCommandDispatchInput = {
  command: {
    id: string;
    tenantId: string;
    deviceId: string;
    type: RemoteCommandType;
    payload?: Prisma.JsonValue | null;
    reason?: string | null;
    expiresAt?: Date | null;
    createdAt: Date;
  };
  device: MdmDeviceIdentity;
};

export type MdmCommandDispatchResult = {
  accepted: boolean;
  connector: MdmConnectorKey;
  connectorCommandId?: string;
  operationName?: string;
  request?: Record<string, unknown>;
  response?: Record<string, unknown>;
  failureReason?: string;
  retryable?: boolean;
};

export type MdmPolicyPublishInput = {
  tenantId: string;
  language?: "en" | "ur";
  policy: {
    id: string;
    name: string;
    version: number;
    rules: PolicyRuleSet;
  };
  apps: Array<
    Pick<
      AppCatalogItem,
      "installRules" | "name" | "packageId" | "approvalStatus"
    >
  >;
  offlineResources: Array<{
    id: string;
    title: string;
    type: string;
    url: string;
    version: number;
    sha256: string;
    sizeBytes: number;
    expiresAtEpochMillis: number | null;
  }>;
};

export type MdmPolicyPublishResult = {
  accepted: boolean;
  connector: MdmConnectorKey;
  mdmPolicyName?: string;
  request?: Record<string, unknown>;
  response?: Record<string, unknown>;
  failureReason?: string;
  retryable?: boolean;
  skipped?: boolean;
};

export type MdmEnrollmentTokenCreateInput = {
  tenantId: string;
  batchId: string;
  expiresAt?: Date;
  maxDevices?: number;
  policyName?: string;
};

export type MdmEnrollmentTokenCreateResult = {
  accepted: boolean;
  connector: MdmConnectorKey;
  enterpriseName?: string;
  tokenName?: string;
  tokenValue?: string;
  qrCode?: string;
  expirationTimestamp?: string;
  policyName?: string;
  request?: Record<string, unknown>;
  response?: Record<string, unknown>;
  failureReason?: string;
  retryable?: boolean;
};

export type MdmEnrollmentTokenDeleteInput = {
  tenantId: string;
  tokenName: string;
};

export type MdmEnrollmentTokenDeleteResult = {
  accepted: boolean;
  connector: MdmConnectorKey;
  tokenName: string;
  failureReason?: string;
  retryable?: boolean;
};

export interface MdmConnector {
  readonly key: MdmConnectorKey;
  createEnrollmentToken(
    input: MdmEnrollmentTokenCreateInput,
  ): Promise<MdmEnrollmentTokenCreateResult>;
  deleteEnrollmentToken(
    input: MdmEnrollmentTokenDeleteInput,
  ): Promise<MdmEnrollmentTokenDeleteResult>;
  dispatchCommand(
    input: MdmCommandDispatchInput,
  ): Promise<MdmCommandDispatchResult>;
  publishPolicy(input: MdmPolicyPublishInput): Promise<MdmPolicyPublishResult>;
}

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

export interface MdmConnector {
  readonly key: MdmConnectorKey;
  dispatchCommand(
    input: MdmCommandDispatchInput,
  ): Promise<MdmCommandDispatchResult>;
  publishPolicy(input: MdmPolicyPublishInput): Promise<MdmPolicyPublishResult>;
}

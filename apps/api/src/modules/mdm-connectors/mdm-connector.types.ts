import type { RemoteCommandType } from "@virtual-school/shared";
import type { Prisma } from "../../generated/prisma";

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

export interface MdmConnector {
  readonly key: MdmConnectorKey;
  dispatchCommand(
    input: MdmCommandDispatchInput,
  ): Promise<MdmCommandDispatchResult>;
}

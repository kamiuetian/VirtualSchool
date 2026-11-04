import { Injectable } from "@nestjs/common";
import type { RemoteCommandType } from "@virtual-school/shared";
import { GoogleAuth } from "google-auth-library";
import type { Prisma, RemoteCommand } from "../../../api/src/generated/prisma";

type DispatchableDevice = {
  connectorDeviceName: string | null;
  enrollmentId: string | null;
};

export type WorkerMdmDispatchResult = {
  accepted: boolean;
  connector: "ANDROID_MANAGEMENT_API" | "STUB";
  connectorCommandId?: string;
  failureReason?: string;
  request?: Record<string, unknown>;
  response?: Record<string, unknown>;
  retryable?: boolean;
};

type AndroidOperation = Record<string, unknown> & { name?: string };

const androidManagementScope =
  "https://www.googleapis.com/auth/androidmanagement";

@Injectable()
export class WorkerMdmConnector {
  private readonly auth = new GoogleAuth({
    scopes: [androidManagementScope],
  });

  constructor() {
    if (process.env.MDM_CONNECTOR_MODE !== "android-management") {
      throw new Error(
        "MDM_CONNECTOR_MODE must be explicitly set to android-management for the worker",
      );
    }
  }

  async dispatchCommand(
    command: RemoteCommand,
    device: DispatchableDevice,
  ): Promise<WorkerMdmDispatchResult> {
    const deviceName = this.resolveDeviceName(device);
    if (!deviceName) {
      return {
        accepted: false,
        connector: "ANDROID_MANAGEMENT_API",
        failureReason:
          "Device is missing Android Management API resource identity",
        retryable: false,
      };
    }

    const request = this.mapCommand(command);
    if (!request) {
      return {
        accepted: false,
        connector: "ANDROID_MANAGEMENT_API",
        failureReason: `${command.type} is not supported by direct Android Management API command dispatch in Phase 1`,
        retryable: false,
      };
    }

    try {
      const client = await this.auth.getClient();
      const baseUrl =
        process.env.ANDROID_MANAGEMENT_API_BASE_URL ??
        "https://androidmanagement.googleapis.com";
      const response = await client.request<AndroidOperation>({
        data: request,
        method: "POST",
        url: `${baseUrl}/v1/${deviceName}:issueCommand`,
      });

      return {
        accepted: true,
        connector: "ANDROID_MANAGEMENT_API",
        connectorCommandId: response.data.name,
        request,
        response: response.data,
      };
    } catch (error) {
      return {
        accepted: false,
        connector: "ANDROID_MANAGEMENT_API",
        failureReason:
          error instanceof Error ? error.message : "Connector dispatch failed",
        retryable: true,
      };
    }
  }

  private mapCommand(command: RemoteCommand): Record<string, unknown> | null {
    const duration = `${Math.max(
      command.expiresAt
        ? Math.ceil((command.expiresAt.getTime() - Date.now()) / 1000)
        : 600,
      1,
    )}s`;

    if ((command.type as RemoteCommandType) === "LOCK") {
      return { duration, type: "LOCK" };
    }

    if ((command.type as RemoteCommandType) === "WIPE") {
      const payload = this.jsonRecord(command.payload);
      return {
        duration,
        type: "WIPE",
        wipeParams: {
          wipeDataFlags:
            payload?.preserveFactoryResetProtection === true
              ? ["PRESERVE_RESET_PROTECTION_DATA"]
              : [],
          wipeReason: {
            defaultMessage:
              command.reason ??
              "Device wipe requested by school administrator.",
          },
        },
      };
    }

    return null;
  }

  private resolveDeviceName(device: DispatchableDevice): string | undefined {
    if (device.connectorDeviceName) {
      return device.connectorDeviceName;
    }

    const enterpriseId =
      process.env.ANDROID_MANAGEMENT_ENTERPRISE_ID ??
      process.env.ANDROID_ENTERPRISE_ID;
    return enterpriseId && device.enrollmentId
      ? `enterprises/${enterpriseId}/devices/${device.enrollmentId}`
      : undefined;
  }

  private jsonRecord(value: Prisma.JsonValue): Record<string, unknown> | null {
    return typeof value === "object" && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  }
}

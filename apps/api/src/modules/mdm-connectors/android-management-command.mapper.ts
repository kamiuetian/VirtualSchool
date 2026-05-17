import { Injectable } from "@nestjs/common";
import type { RemoteCommandType } from "@virtual-school/shared";
import type { Prisma } from "../../generated/prisma";

export type AndroidManagementCommand = {
  type: string;
  duration?: string;
  wipeParams?: {
    wipeDataFlags?: string[];
    wipeReason?: {
      defaultMessage: string;
    };
  };
};

export type AndroidCommandMappingResult =
  | {
      supported: true;
      command: AndroidManagementCommand;
    }
  | {
      supported: false;
      failureReason: string;
    };

@Injectable()
export class AndroidManagementCommandMapper {
  map(input: {
    type: RemoteCommandType;
    payload?: Prisma.JsonValue | null;
    reason?: string | null;
    ttlSeconds?: number;
  }): AndroidCommandMappingResult {
    const duration = `${Math.max(input.ttlSeconds ?? 600, 1)}s`;

    if (input.type === "LOCK") {
      return {
        command: {
          duration,
          type: "LOCK",
        },
        supported: true,
      };
    }

    if (input.type === "WIPE") {
      const payload = this.jsonRecord(input.payload);
      const preserveFactoryResetProtection =
        payload?.preserveFactoryResetProtection === true;

      return {
        command: {
          duration,
          type: "WIPE",
          wipeParams: {
            wipeDataFlags: preserveFactoryResetProtection
              ? ["PRESERVE_RESET_PROTECTION_DATA"]
              : [],
            wipeReason: {
              defaultMessage:
                input.reason ??
                "Device wipe requested by school administrator.",
            },
          },
        },
        supported: true,
      };
    }

    return {
      failureReason: `${input.type} is not supported by direct Android Management API command dispatch in Phase 1`,
      supported: false,
    };
  }

  private jsonRecord(
    value: Prisma.JsonValue | undefined,
  ): Record<string, unknown> | null {
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }

    return null;
  }
}

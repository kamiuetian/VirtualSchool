import { Inject, Injectable } from "@nestjs/common";
import type {
  CommandDispatchRunSummary,
  CommandStatus,
  RemoteCommandType,
} from "@virtual-school/shared";
import {
  Prisma,
  type Device,
  type RemoteCommand,
} from "../../generated/prisma";
import { PrismaService } from "../prisma/prisma.service";
import { MdmConnectorRegistry } from "./mdm-connector.registry";
import type { MdmCommandDispatchResult } from "./mdm-connector.types";

type DispatchableCommand = RemoteCommand & {
  device: Pick<
    Device,
    "connectorDeviceName" | "enrollmentId" | "id" | "mdmConnector" | "tenantId"
  >;
};

const mdmConnectorCommandTypes: RemoteCommandType[] = ["LOCK", "WIPE"];

@Injectable()
export class CommandDispatchService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(MdmConnectorRegistry)
    private readonly connectorRegistry: MdmConnectorRegistry,
  ) {}

  async dispatchQueuedCommands(
    tenantId: string,
    limit = 25,
  ): Promise<CommandDispatchRunSummary> {
    await this.expireOverdueCommands(tenantId);

    const connector = this.connectorRegistry.getActiveConnector();
    const commands = await this.prisma.remoteCommand.findMany({
      include: {
        device: {
          select: {
            connectorDeviceName: true,
            enrollmentId: true,
            id: true,
            mdmConnector: true,
            tenantId: true,
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
      take: limit * 3,
      where: {
        type: {
          in: mdmConnectorCommandTypes,
        },
        status: "QUEUED",
        tenantId,
        OR: [
          {
            expiresAt: null,
          },
          {
            expiresAt: {
              gt: new Date(),
            },
          },
        ],
      },
    });
    const retryableCommands = commands
      .filter((command) => command.attempts < command.maxAttempts)
      .slice(0, limit);
    const run: CommandDispatchRunSummary = {
      accepted: 0,
      attempted: 0,
      commands: [],
      connector: connector.key,
      failed: 0,
      requeued: 0,
      tenantId,
    };

    for (const command of retryableCommands) {
      run.attempted += 1;
      const delivered = await this.markDeliveryAttempt(command);
      let result: MdmCommandDispatchResult;

      try {
        result = await connector.dispatchCommand({
          command: {
            createdAt: delivered.createdAt,
            deviceId: delivered.deviceId,
            expiresAt: delivered.expiresAt,
            id: delivered.id,
            payload: delivered.payload,
            reason: delivered.reason,
            tenantId: delivered.tenantId,
            type: delivered.type as RemoteCommandType,
          },
          device: command.device,
        });
      } catch (error) {
        result = {
          accepted: false,
          connector: connector.key,
          failureReason:
            error instanceof Error
              ? error.message
              : "Connector dispatch failed",
          retryable: true,
        };
      }

      const updated = result.accepted
        ? await this.markAccepted(delivered, result)
        : await this.markRejected(delivered, result);

      if (updated.status === "DELIVERED") {
        run.accepted += 1;
      } else if (updated.status === "QUEUED") {
        run.requeued += 1;
      } else {
        run.failed += 1;
      }

      run.commands.push({
        commandId: updated.id,
        connectorCommandId: updated.connectorCommandId,
        deviceId: updated.deviceId,
        failureReason: updated.failureReason,
        status: updated.status as CommandStatus,
        type: updated.type as RemoteCommandType,
      });
    }

    return run;
  }

  private async expireOverdueCommands(tenantId: string): Promise<void> {
    await this.prisma.remoteCommand.updateMany({
      data: {
        completedAt: new Date(),
        failureReason: "Command expired before connector dispatch",
        status: "EXPIRED",
      },
      where: {
        expiresAt: {
          lte: new Date(),
        },
        status: "QUEUED",
        tenantId,
        type: {
          in: mdmConnectorCommandTypes,
        },
      },
    });
  }

  private async markDeliveryAttempt(
    command: RemoteCommand,
  ): Promise<RemoteCommand> {
    return this.prisma.remoteCommand.update({
      data: {
        attempts: {
          increment: 1,
        },
        deliveredAt: new Date(),
        lastAttemptAt: new Date(),
        status: "DELIVERED",
      },
      where: {
        id: command.id,
      },
    });
  }

  private async markAccepted(
    command: RemoteCommand,
    result: MdmCommandDispatchResult,
  ): Promise<RemoteCommand> {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.remoteCommand.update({
        data: {
          connectorCommandId: result.connectorCommandId,
          failureReason: null,
          result: this.dispatchResultJson(result),
          status: "DELIVERED",
        },
        where: {
          id: command.id,
        },
      });

      await tx.auditEvent.create({
        data: {
          action: "remote_command.dispatch",
          newValue: {
            connector: result.connector,
            connectorCommandId: result.connectorCommandId,
            status: updated.status,
          },
          object: "RemoteCommand",
          objectId: updated.id,
          oldValue: {
            status: command.status,
          },
          outcome: "DELIVERED",
          tenantId: command.tenantId,
        },
      });

      return updated;
    });
  }

  private async markRejected(
    command: RemoteCommand,
    result: MdmCommandDispatchResult,
  ): Promise<RemoteCommand> {
    const expired =
      command.expiresAt !== null && command.expiresAt.getTime() <= Date.now();
    const canRetry =
      result.retryable === true &&
      !expired &&
      command.attempts < command.maxAttempts;
    const nextStatus = canRetry ? "QUEUED" : "FAILED";

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.remoteCommand.update({
        data: {
          completedAt: canRetry ? null : new Date(),
          failureReason:
            result.failureReason ?? "Connector did not accept command",
          result: this.dispatchResultJson(result),
          status: nextStatus,
        },
        where: {
          id: command.id,
        },
      });

      await tx.auditEvent.create({
        data: {
          action: canRetry
            ? "remote_command.dispatch_retry"
            : "remote_command.dispatch_fail",
          newValue: {
            failureReason: updated.failureReason,
            status: updated.status,
          },
          object: "RemoteCommand",
          objectId: updated.id,
          oldValue: {
            status: command.status,
          },
          outcome: canRetry ? "RETRY_QUEUED" : "FAILED",
          tenantId: command.tenantId,
        },
      });

      return updated;
    });
  }

  private dispatchResultJson(
    result: MdmCommandDispatchResult,
  ): Prisma.InputJsonValue {
    const payload: Record<string, Prisma.InputJsonValue | undefined> = {
      accepted: result.accepted,
      connector: result.connector,
    };

    if (result.failureReason) {
      payload.failureReason = result.failureReason;
    }

    if (result.operationName) {
      payload.operationName = result.operationName;
    }

    if (result.request) {
      payload.request = result.request as Prisma.InputJsonValue;
    }

    if (result.response) {
      payload.response = result.response as Prisma.InputJsonValue;
    }

    return payload as Prisma.InputJsonObject;
  }
}

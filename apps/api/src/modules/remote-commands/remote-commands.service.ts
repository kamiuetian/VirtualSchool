import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  RemoteCommandSummary,
  RemoteCommandType,
} from "@virtual-school/shared";
import {
  Prisma,
  type Device,
  type RemoteCommand,
} from "../../generated/prisma";
import { PrismaService } from "../prisma/prisma.service";
import type { CreateRemoteCommandDto } from "./dto/create-remote-command.dto";
import type { CreateWipeCommandDto } from "./dto/create-wipe-command.dto";
import type { RecordCommandResultDto } from "./dto/record-command-result.dto";
import type { RecordDeliveryFailureDto } from "./dto/record-delivery-failure.dto";

const defaultCommandTtlMinutes = 60;
const destructiveCommandTypes = new Set<RemoteCommandType>(["WIPE", "RETIRE"]);

@Injectable()
export class RemoteCommandsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listDeviceCommands(
    tenantId: string,
    deviceId: string,
  ): Promise<RemoteCommandSummary[]> {
    await this.ensureDevice(tenantId, deviceId);

    const commands = await this.prisma.remoteCommand.findMany({
      orderBy: {
        createdAt: "desc",
      },
      where: {
        deviceId,
        tenantId,
      },
    });

    return commands.map((command) => this.toRemoteCommandSummary(command));
  }

  async createDeviceCommand(
    tenantId: string,
    deviceId: string,
    input: CreateRemoteCommandDto,
    requestedBy: string | undefined,
  ): Promise<RemoteCommandSummary> {
    const device = await this.ensureDevice(tenantId, deviceId);

    if (destructiveCommandTypes.has(input.type)) {
      throw new BadRequestException(
        `${input.type} must use a dedicated destructive command endpoint`,
      );
    }

    this.validateCommandPayload(input);

    return this.queueCommand(tenantId, device, {
      maxAttempts: input.maxAttempts,
      payload: input.payload,
      reason: input.reason,
      requestedBy,
      ttlMinutes: input.ttlMinutes,
      type: input.type,
    });
  }

  async createWipeCommand(
    tenantId: string,
    deviceId: string,
    input: CreateWipeCommandDto,
    requestedBy: string | undefined,
  ): Promise<RemoteCommandSummary> {
    const device = await this.ensureDevice(tenantId, deviceId);

    if (input.confirmationSerialNumber !== device.serialNumber) {
      throw new BadRequestException(
        "Wipe confirmation serial number does not match the device",
      );
    }

    return this.queueCommand(tenantId, device, {
      maxAttempts: 1,
      payload: {
        preserveFactoryResetProtection:
          input.preserveFactoryResetProtection ?? false,
      },
      reason: input.reason,
      requestedBy,
      ttlMinutes: input.ttlMinutes,
      type: "WIPE",
    });
  }

  async claimQueuedCommands(
    tenantId: string,
    deviceId: string,
    limit = 10,
  ): Promise<RemoteCommandSummary[]> {
    await this.expireOverdueCommands(tenantId);
    await this.ensureDevice(tenantId, deviceId);

    const now = new Date();
    const commands = await this.prisma.remoteCommand.findMany({
      orderBy: {
        createdAt: "asc",
      },
      take: limit * 3,
      where: {
        deviceId,
        status: "QUEUED",
        tenantId,
        OR: [
          {
            expiresAt: null,
          },
          {
            expiresAt: {
              gt: now,
            },
          },
        ],
      },
    });
    const retryableCommands = commands
      .filter((command) => command.attempts < command.maxAttempts)
      .slice(0, limit);

    const claimed: RemoteCommand[] = [];

    for (const command of retryableCommands) {
      const updated = await this.prisma.remoteCommand.update({
        data: {
          attempts: {
            increment: 1,
          },
          deliveredAt: now,
          lastAttemptAt: now,
          status: "DELIVERED",
        },
        where: {
          id: command.id,
        },
      });

      claimed.push(updated);
    }

    return claimed.map((command) => this.toRemoteCommandSummary(command));
  }

  async recordDeliveryFailure(
    tenantId: string,
    deviceId: string,
    commandId: string,
    input: RecordDeliveryFailureDto,
  ): Promise<RemoteCommandSummary> {
    const command = await this.getCommandForDevice(
      tenantId,
      deviceId,
      commandId,
    );

    if (!["QUEUED", "DELIVERED"].includes(command.status)) {
      throw new BadRequestException(
        `Delivery failure cannot be recorded for ${command.status} command`,
      );
    }

    const expired =
      command.expiresAt !== null && command.expiresAt.getTime() <= Date.now();
    const canRetry = !expired && command.attempts < command.maxAttempts;
    const updated = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.remoteCommand.update({
        data: {
          completedAt: canRetry ? null : new Date(),
          connectorCommandId:
            input.connectorCommandId ?? command.connectorCommandId,
          failureReason:
            input.failureReason ?? "Command delivery failed before execution",
          status: canRetry ? "QUEUED" : "FAILED",
        },
        where: {
          id: command.id,
        },
      });

      await tx.auditEvent.create({
        data: {
          action: canRetry ? "remote_command.retry" : "remote_command.fail",
          newValue: {
            attempts: saved.attempts,
            failureReason: saved.failureReason,
            status: saved.status,
          },
          object: "RemoteCommand",
          objectId: saved.id,
          oldValue: {
            attempts: command.attempts,
            status: command.status,
          },
          outcome: canRetry ? "RETRY_QUEUED" : "FAILED",
          tenantId,
        },
      });

      return saved;
    });

    return this.toRemoteCommandSummary(updated);
  }

  async recordCommandResult(
    tenantId: string,
    deviceId: string,
    commandId: string,
    input: RecordCommandResultDto,
  ): Promise<RemoteCommandSummary> {
    const command = await this.getCommandForDevice(
      tenantId,
      deviceId,
      commandId,
    );

    if (command.status !== "DELIVERED") {
      throw new BadRequestException(
        `Only DELIVERED commands can record execution results`,
      );
    }

    if (input.status === "FAILED" && !input.failureReason) {
      throw new BadRequestException("Failed command results require a reason");
    }

    const completedAt = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.remoteCommand.update({
        data: {
          completedAt,
          connectorCommandId:
            input.connectorCommandId ?? command.connectorCommandId,
          failureReason: input.failureReason,
          result: input.result as Prisma.InputJsonValue,
          status: input.status,
        },
        where: {
          id: command.id,
        },
      });

      if (input.status === "EXECUTED") {
        await this.applySuccessfulCommandSideEffects(
          tx,
          tenantId,
          deviceId,
          command.type as RemoteCommandType,
        );
      }

      await tx.auditEvent.create({
        data: {
          action:
            input.status === "EXECUTED"
              ? "remote_command.execute"
              : "remote_command.fail",
          newValue: {
            failureReason: saved.failureReason,
            status: saved.status,
          },
          object: "RemoteCommand",
          objectId: saved.id,
          oldValue: {
            status: command.status,
          },
          outcome: input.status,
          tenantId,
        },
      });

      return saved;
    });

    return this.toRemoteCommandSummary(updated);
  }

  async expireOverdueCommands(tenantId: string): Promise<number> {
    const now = new Date();
    const overdueCommands = await this.prisma.remoteCommand.findMany({
      where: {
        expiresAt: {
          lte: now,
        },
        status: {
          in: ["QUEUED", "DELIVERED"],
        },
        tenantId,
      },
    });

    for (const command of overdueCommands) {
      await this.prisma.$transaction(async (tx) => {
        await tx.remoteCommand.update({
          data: {
            completedAt: now,
            failureReason: "Command expired before completion",
            status: "EXPIRED",
          },
          where: {
            id: command.id,
          },
        });

        await tx.auditEvent.create({
          data: {
            action: "remote_command.expire",
            newValue: {
              status: "EXPIRED",
            },
            object: "RemoteCommand",
            objectId: command.id,
            oldValue: {
              status: command.status,
            },
            outcome: "EXPIRED",
            tenantId,
          },
        });
      });
    }

    return overdueCommands.length;
  }

  private async queueCommand(
    tenantId: string,
    device: Pick<Device, "id" | "serialNumber" | "status">,
    input: {
      type: RemoteCommandType;
      reason?: string;
      requestedBy?: string;
      payload?: Record<string, unknown>;
      ttlMinutes?: number;
      maxAttempts?: number;
    },
  ): Promise<RemoteCommandSummary> {
    const expiresAt = new Date(
      Date.now() + (input.ttlMinutes ?? defaultCommandTtlMinutes) * 60_000,
    );
    const command = await this.prisma.$transaction(async (tx) => {
      const created = await tx.remoteCommand.create({
        data: {
          deviceId: device.id,
          expiresAt,
          maxAttempts: input.maxAttempts ?? 3,
          payload: input.payload as Prisma.InputJsonValue,
          reason: input.reason,
          requestedBy: input.requestedBy,
          status: "QUEUED",
          tenantId,
          type: input.type,
        },
      });

      await tx.auditEvent.create({
        data: {
          action: "remote_command.queue",
          actorId: input.requestedBy,
          newValue: {
            expiresAt: created.expiresAt,
            maxAttempts: created.maxAttempts,
            status: created.status,
            type: created.type,
          },
          object: "RemoteCommand",
          objectId: created.id,
          outcome: "QUEUED",
          reason: input.reason,
          tenantId,
        },
      });

      return created;
    });

    return this.toRemoteCommandSummary(command);
  }

  private validateCommandPayload(input: CreateRemoteCommandDto): void {
    if (input.type === "SEND_MESSAGE" && !input.payload?.message) {
      throw new BadRequestException(
        "SEND_MESSAGE commands require payload.message",
      );
    }
  }

  private async ensureDevice(
    tenantId: string,
    deviceId: string,
  ): Promise<Pick<Device, "id" | "serialNumber" | "status">> {
    const device = await this.prisma.device.findFirst({
      select: {
        id: true,
        serialNumber: true,
        status: true,
      },
      where: {
        id: deviceId,
        tenantId,
      },
    });

    if (!device) {
      throw new NotFoundException(
        `Device ${deviceId} was not found for tenant ${tenantId}`,
      );
    }

    return device;
  }

  private async getCommandForDevice(
    tenantId: string,
    deviceId: string,
    commandId: string,
  ): Promise<RemoteCommand> {
    const command = await this.prisma.remoteCommand.findFirst({
      where: {
        deviceId,
        id: commandId,
        tenantId,
      },
    });

    if (!command) {
      throw new NotFoundException(
        `Command ${commandId} was not found for device ${deviceId}`,
      );
    }

    return command;
  }

  private async applySuccessfulCommandSideEffects(
    tx: Prisma.TransactionClient,
    tenantId: string,
    deviceId: string,
    type: RemoteCommandType,
  ): Promise<void> {
    const statusByCommand: Partial<
      Record<RemoteCommandType, Device["status"]>
    > = {
      LOCK: "LOCKED",
      RETIRE: "RETIRED",
      UNLOCK: "ONLINE",
      WIPE: "RETIRED",
    };
    const status = statusByCommand[type];

    if (!status) {
      return;
    }

    await tx.device.updateMany({
      data: {
        status,
      },
      where: {
        id: deviceId,
        tenantId,
      },
    });
  }

  private toRemoteCommandSummary(command: RemoteCommand): RemoteCommandSummary {
    return {
      attempts: command.attempts,
      completedAt: command.completedAt?.toISOString() ?? null,
      connectorCommandId: command.connectorCommandId,
      createdAt: command.createdAt.toISOString(),
      deliveredAt: command.deliveredAt?.toISOString() ?? null,
      deviceId: command.deviceId,
      expiresAt: command.expiresAt?.toISOString() ?? null,
      failureReason: command.failureReason,
      id: command.id,
      lastAttemptAt: command.lastAttemptAt?.toISOString() ?? null,
      maxAttempts: command.maxAttempts,
      payload: this.jsonRecord(command.payload),
      reason: command.reason,
      requestedBy: command.requestedBy,
      result: this.jsonRecord(command.result),
      status: command.status,
      tenantId: command.tenantId,
      type: command.type as RemoteCommandType,
      updatedAt: command.updatedAt.toISOString(),
    };
  }

  private jsonRecord(value: Prisma.JsonValue): Record<string, unknown> | null {
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }

    return null;
  }
}

import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { SupportService } from "./support.service";

const actor = {
  subject: "teacher-1",
  role: "TEACHER",
  email: "teacher@school.test",
} as any;

describe("SupportService helpdesk tickets", () => {
  it("routes a linked teacher ticket with a bounded SLA and audit evidence", async () => {
    const create = vi.fn(async ({ data }: any) => ({
      id: "ticket-1",
      status: "OPEN",
      assigneeId: null,
      firstResponseAt: null,
      resolvedAt: null,
      notes: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      ...data,
    }));
    const audit = vi.fn();
    const prisma = {
      device: {
        findFirst: async () => ({ id: "device-1", classId: "class-1" }),
      },
      classSection: { findFirst: async () => ({ id: "class-1" }) },
      teacherClassAssignment: {
        findFirst: async () => ({ classId: "class-1" }),
      },
      supportTicket: { create },
      auditEvent: { create: audit },
      $transaction: async (work: (tx: any) => unknown) =>
        work({ supportTicket: { create }, auditEvent: { create: audit } }),
    };
    const result = await new SupportService(prisma as never).createTicket(
      "tenant-1",
      {
        classId: "class-1",
        deviceId: "device-1",
        subject: "Cannot launch lesson",
        description: "The approved resource does not open",
        priority: "HIGH",
      },
      actor,
    );
    expect(result).toMatchObject({
      id: "ticket-1",
      priority: "HIGH",
      routingQueue: "HELPDESK",
    });
    expect(new Date(result.slaDueAt).getTime()).toBeGreaterThan(Date.now());
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "support_ticket.create",
          outcome: "ROUTED",
        }),
      }),
    );
  });

  it("prevents teachers from creating or noting tickets outside assigned classes", async () => {
    const prisma = {
      classSection: { findFirst: async () => ({ id: "class-2" }) },
      teacherClassAssignment: { findFirst: async () => null },
      supportTicket: {
        findFirst: async () => ({
          id: "ticket-2",
          tenantId: "tenant-1",
          classId: "class-2",
        }),
      },
    };
    const service = new SupportService(prisma as never);
    await expect(
      service.createTicket(
        "tenant-1",
        { classId: "class-2", subject: "Issue", description: "Details" },
        actor,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.addTicketNote(
        "tenant-1",
        "ticket-2",
        { body: "Private note" },
        actor,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.updateTicket(
        "tenant-1",
        "ticket-2",
        { status: "RESOLVED" },
        actor,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("does not update a ticket from another tenant", async () => {
    const service = new SupportService({
      supportTicket: { findFirst: async () => null },
    } as never);
    await expect(
      service.updateTicket(
        "tenant-1",
        "foreign-ticket",
        { status: "RESOLVED" },
        { subject: "agent-1", role: "SUPPORT_AGENT" } as any,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

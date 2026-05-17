import { describe, expect, it, vi } from "vitest";
import { RosterController } from "./roster.controller";

describe("RosterController", () => {
  it("delegates student creation to the roster service", async () => {
    const createStudent = vi.fn().mockResolvedValue({
      guardianCount: 0,
      id: "student-1",
      name: "Ayesha Khan",
      studentCode: "S-001",
      tenantId: "tenant-1"
    });
    const controller = new RosterController({
      addStudentToClass: vi.fn(),
      createClass: vi.fn(),
      createStudent,
      listClasses: vi.fn(),
      listStudents: vi.fn()
    } as never);

    await expect(
      controller.createStudent("tenant-1", {
        grade: "5",
        name: "Ayesha Khan",
        studentCode: "S-001"
      })
    ).resolves.toMatchObject({
      id: "student-1"
    });
    expect(createStudent).toHaveBeenCalledOnce();
  });
});

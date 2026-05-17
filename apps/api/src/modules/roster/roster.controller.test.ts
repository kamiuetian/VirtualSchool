import { describe, expect, it, vi } from "vitest";
import { RosterController } from "./roster.controller";

describe("RosterController", () => {
  it("delegates student creation to the roster service", async () => {
    const createStudent = vi.fn().mockResolvedValue({
      guardianCount: 0,
      id: "student-1",
      name: "Ayesha Khan",
      studentCode: "S-001",
      tenantId: "tenant-1",
    });
    const controller = new RosterController({
      addStudentToClass: vi.fn(),
      commitRosterImport: vi.fn(),
      createClass: vi.fn(),
      createStudent,
      getRosterImport: vi.fn(),
      getRosterImportErrorReportCsv: vi.fn(),
      listClasses: vi.fn(),
      listStudents: vi.fn(),
      previewRosterImport: vi.fn(),
    } as never);

    await expect(
      controller.createStudent("tenant-1", {
        grade: "5",
        name: "Ayesha Khan",
        studentCode: "S-001",
      }),
    ).resolves.toMatchObject({
      id: "student-1",
    });
    expect(createStudent).toHaveBeenCalledOnce();
  });

  it("delegates roster import preview with authenticated actor", async () => {
    const previewRosterImport = vi.fn().mockResolvedValue({
      errorRows: 0,
      id: "import-1",
      status: "PREVIEWED",
      validRows: 1,
    });
    const controller = new RosterController({
      addStudentToClass: vi.fn(),
      commitRosterImport: vi.fn(),
      createClass: vi.fn(),
      createStudent: vi.fn(),
      getRosterImport: vi.fn(),
      getRosterImportErrorReportCsv: vi.fn(),
      listClasses: vi.fn(),
      listStudents: vi.fn(),
      previewRosterImport,
    } as never);

    await expect(
      controller.previewRosterImport(
        "tenant-1",
        {
          csv: "studentCode,name,grade\nS-001,Ayesha Khan,5",
        },
        {
          user: {
            subject: "admin-1",
          },
        } as never,
      ),
    ).resolves.toMatchObject({
      id: "import-1",
    });
    expect(previewRosterImport).toHaveBeenCalledWith(
      "tenant-1",
      expect.objectContaining({
        csv: expect.stringContaining("studentCode"),
      }),
      "admin-1",
    );
  });

  it("delegates roster import commit with authenticated actor", async () => {
    const commitRosterImport = vi.fn().mockResolvedValue({
      createdStudents: 1,
      import: {
        id: "import-1",
        status: "COMMITTED",
      },
    });
    const controller = new RosterController({
      addStudentToClass: vi.fn(),
      commitRosterImport,
      createClass: vi.fn(),
      createStudent: vi.fn(),
      getRosterImport: vi.fn(),
      getRosterImportErrorReportCsv: vi.fn(),
      listClasses: vi.fn(),
      listStudents: vi.fn(),
      previewRosterImport: vi.fn(),
    } as never);

    await expect(
      controller.commitRosterImport("tenant-1", "import-1", {
        user: {
          subject: "admin-1",
        },
      } as never),
    ).resolves.toMatchObject({
      createdStudents: 1,
    });
    expect(commitRosterImport).toHaveBeenCalledWith(
      "tenant-1",
      "import-1",
      "admin-1",
    );
  });
});

const deviceAssignmentSampleCsv = [
  ["deviceId", "studentId", "classId", "branchId", "tags", "reason"],
  [
    "device-tab-001",
    "student-sara",
    "class-4-blue",
    "branch-main",
    "pilot,grade-4",
    "Assigned during grade 4 rollout",
  ],
  [
    "device-tab-002",
    "",
    "class-4-blue",
    "branch-main",
    "pilot,shared-cart",
    "Assigned to shared class cart",
  ],
]
  .map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(","))
  .join("\n");

export function GET(): Response {
  return new Response(deviceAssignmentSampleCsv, {
    headers: {
      "Content-Disposition":
        'attachment; filename="device-assignment-import-sample.csv"',
      "Content-Type": "text/csv; charset=utf-8",
    },
  });
}

const deviceAssignmentSampleCsv = [
  ["deviceId", "studentId", "classId", "branchId", "tags", "reason"],
  [
    "SAMPLE-DEVICE-001",
    "SAMPLE-STUDENT-001",
    "SAMPLE-CLASS-001",
    "SAMPLE-BRANCH-001",
    "pilot,grade-4",
    "Assigned during grade 4 rollout",
  ],
  [
    "SAMPLE-DEVICE-002",
    "",
    "SAMPLE-CLASS-001",
    "SAMPLE-BRANCH-001",
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

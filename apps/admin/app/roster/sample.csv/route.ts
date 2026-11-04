const sampleRosterCsv = [
  [
    "studentCode",
    "name",
    "grade",
    "section",
    "status",
    "guardianName",
    "guardianEmail",
    "guardianPhone",
    "guardianRelationship",
    "className",
    "classSubject",
    "branchId",
  ],
  [
    "SAMPLE-STUDENT-001",
    "SAMPLE Student One",
    "4",
    "Blue",
    "ACTIVE",
    "SAMPLE Guardian One",
    "sample.guardian.one@example.invalid",
    "+1 202 555 0101",
    "Parent",
    "SAMPLE Grade 4 Blue",
    "Science",
    "",
  ],
  [
    "SAMPLE-STUDENT-002",
    "SAMPLE Student Two",
    "4",
    "Blue",
    "ACTIVE",
    "SAMPLE Guardian Two",
    "sample.guardian.two@example.invalid",
    "+1 202 555 0102",
    "Guardian",
    "SAMPLE Grade 4 Blue",
    "Science",
    "",
  ],
]
  .map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(","))
  .join("\n");

export function GET(): Response {
  return new Response(sampleRosterCsv, {
    headers: {
      "Content-Disposition": 'attachment; filename="roster-import-sample.csv"',
      "Content-Type": "text/csv; charset=utf-8",
    },
  });
}

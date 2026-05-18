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
    "S-1001",
    "Sara Ahmed",
    "4",
    "Blue",
    "ACTIVE",
    "Fatima Ahmed",
    "fatima.ahmed@example.edu",
    "+1 555 0101",
    "Parent",
    "Grade 4 Blue",
    "Science",
    "",
  ],
  [
    "S-1002",
    "Daniel Lee",
    "4",
    "Blue",
    "ACTIVE",
    "Mina Lee",
    "mina.lee@example.edu",
    "+1 555 0102",
    "Guardian",
    "Grade 4 Blue",
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

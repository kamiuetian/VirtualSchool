const staffSampleCsv = [
  ["name", "email", "role", "branchId"],
  ["SAMPLE Administrator", "sample.admin@example.invalid", "SCHOOL_ADMIN", ""],
  ["SAMPLE Teacher", "sample.teacher@example.invalid", "TEACHER", ""],
  ["SAMPLE IT Administrator", "sample.it@example.invalid", "IT_ADMIN", ""],
]
  .map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(","))
  .join("\n");

export function GET(): Response {
  return new Response(staffSampleCsv, {
    headers: {
      "Content-Disposition": 'attachment; filename="staff-import-sample.csv"',
      "Content-Type": "text/csv; charset=utf-8",
    },
  });
}

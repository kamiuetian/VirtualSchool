const classesSampleCsv = [
  ["name", "grade", "subject", "branchId"],
  ["Grade 4 Blue", "4", "Science", ""],
  ["Grade 4 Mathematics", "4", "Mathematics", ""],
  ["Grade 5 Reading", "5", "English", ""],
]
  .map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(","))
  .join("\n");

export function GET(): Response {
  return new Response(classesSampleCsv, {
    headers: {
      "Content-Disposition": 'attachment; filename="classes-import-sample.csv"',
      "Content-Type": "text/csv; charset=utf-8",
    },
  });
}

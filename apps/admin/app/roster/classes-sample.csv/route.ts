const classesSampleCsv = [
  ["name", "grade", "subject", "branchId"],
  ["SAMPLE Grade 4 Blue", "4", "Science", ""],
  ["SAMPLE Grade 4 Mathematics", "4", "Mathematics", ""],
  ["SAMPLE Grade 5 Reading", "5", "English", ""],
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

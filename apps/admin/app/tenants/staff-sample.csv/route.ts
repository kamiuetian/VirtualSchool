const staffSampleCsv = [
  ["name", "email", "role", "branchId"],
  ["Aisha Khan", "aisha.khan@example.edu", "SCHOOL_ADMIN", ""],
  ["Omar Malik", "omar.malik@example.edu", "TEACHER", ""],
  ["Mina Patel", "mina.patel@example.edu", "IT_ADMIN", ""],
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

const appsSampleCsv = [
  [
    "name",
    "packageId",
    "category",
    "approvedGrades",
    "installType",
    "approvalStatus",
    "description",
    "iconUrl",
  ],
  [
    "Google Classroom",
    "com.google.android.apps.classroom",
    "Learning",
    "4,5",
    "FORCE_INSTALLED",
    "APPROVED",
    "Classroom workflow app",
    "",
  ],
  [
    "Khan Academy",
    "org.khanacademy.android",
    "Learning",
    "4,5,6",
    "AVAILABLE",
    "APPROVED",
    "Practice and lessons",
    "",
  ],
]
  .map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(","))
  .join("\n");

export function GET(): Response {
  return new Response(appsSampleCsv, {
    headers: {
      "Content-Disposition":
        'attachment; filename="app-catalog-import-sample.csv"',
      "Content-Type": "text/csv; charset=utf-8",
    },
  });
}

import { adminApiRawGet, getAdminData } from "../../../lib/api";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const data = await getAdminData("/roster");
  const importId = new URL(request.url).searchParams.get("importId");

  if (!data.selectedTenant || !importId) {
    return new Response("Roster import not selected", { status: 404 });
  }

  const response = await adminApiRawGet(
    `/tenants/${data.selectedTenant.id}/roster-imports/${importId}/error-report.csv`,
  );

  if (!response.ok) {
    return new Response("Roster import error report is unavailable", {
      status: response.status,
    });
  }

  return new Response(await response.text(), {
    headers: {
      "Content-Disposition": 'attachment; filename="roster-import-errors.csv"',
      "Content-Type": "text/csv; charset=utf-8",
    },
  });
}

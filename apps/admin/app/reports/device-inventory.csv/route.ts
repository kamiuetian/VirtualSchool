import { adminApiRawGet, getAdminData } from "../../../lib/api";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const data = await getAdminData();

  if (!data.selectedTenant) {
    return new Response("No school tenant selected", { status: 404 });
  }

  const response = await adminApiRawGet(
    `/tenants/${data.selectedTenant.id}/reports/device-inventory.csv`,
  );

  if (!response.ok) {
    return new Response("Device inventory export is unavailable", {
      status: response.status,
    });
  }

  return new Response(await response.text(), {
    headers: {
      "Content-Disposition": 'attachment; filename="device-inventory.csv"',
      "Content-Type": "text/csv; charset=utf-8",
    },
  });
}

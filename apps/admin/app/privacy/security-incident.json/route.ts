import { NextRequest, NextResponse } from "next/server";
import { adminApiRawGet } from "../../../lib/api";
import { requirePortalRouteAccess } from "../../../lib/auth/portal-access";

export async function GET(request: NextRequest) {
  await requirePortalRouteAccess("/privacy");
  const tenantId = request.nextUrl.searchParams.get("tenantId");
  const incidentId = request.nextUrl.searchParams.get("incidentId");
  if (!tenantId || !incidentId)
    return new NextResponse("Missing incident selection", { status: 400 });
  const response = await adminApiRawGet(
    `/tenants/${encodeURIComponent(tenantId)}/privacy/security-incidents/${encodeURIComponent(incidentId)}/export`,
  );
  if (!response.ok)
    return new NextResponse("Unable to export incident", {
      status: response.status,
    });
  return new NextResponse(await response.text(), {
    headers: {
      "Content-Disposition": `attachment; filename="security-incident-${incidentId}.json"`,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

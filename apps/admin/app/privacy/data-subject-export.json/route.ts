import { NextRequest, NextResponse } from "next/server";
import { adminApiRawGet } from "../../../lib/api";
import { requirePortalRouteAccess } from "../../../lib/auth/portal-access";

export async function GET(request: NextRequest) {
  await requirePortalRouteAccess("/privacy");
  const tenantId = request.nextUrl.searchParams.get("tenantId");
  const requestId = request.nextUrl.searchParams.get("requestId");
  if (!tenantId || !requestId)
    return new NextResponse("Missing data-subject export selection", {
      status: 400,
    });
  const response = await adminApiRawGet(
    `/tenants/${encodeURIComponent(tenantId)}/privacy/data-subject-requests/${encodeURIComponent(requestId)}/download`,
  );
  if (!response.ok)
    return new NextResponse("Unable to download data-subject export", {
      status: response.status,
    });
  return new NextResponse(await response.text(), {
    headers: {
      "Content-Disposition": `attachment; filename="data-subject-export-${requestId}.json"`,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

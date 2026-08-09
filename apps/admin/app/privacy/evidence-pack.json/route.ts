import { NextRequest, NextResponse } from "next/server";
import { adminApiRawGet } from "../../../lib/api";
import { requirePortalRouteAccess } from "../../../lib/auth/portal-access";

export async function GET(request: NextRequest) {
  await requirePortalRouteAccess("/privacy");
  const tenantId = request.nextUrl.searchParams.get("tenantId");
  const packId = request.nextUrl.searchParams.get("packId");
  if (!tenantId || !packId)
    return new NextResponse("Missing evidence pack selection", { status: 400 });
  const response = await adminApiRawGet(
    `/tenants/${encodeURIComponent(tenantId)}/privacy/evidence-packs/${encodeURIComponent(packId)}/download`,
  );
  if (!response.ok)
    return new NextResponse("Unable to download evidence pack", {
      status: response.status,
    });
  return new NextResponse(await response.text(), {
    headers: {
      "Content-Disposition": `attachment; filename="compliance-evidence-${packId}.json"`,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

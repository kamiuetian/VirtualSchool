import { NextRequest, NextResponse } from "next/server";
import { adminApiRawGet } from "../../../lib/api";
import { requirePortalRouteAccess } from "../../../lib/auth/portal-access";

export async function GET(request: NextRequest) {
  await requirePortalRouteAccess("/access");
  const tenantId = request.nextUrl.searchParams.get("tenantId");
  const reviewId = request.nextUrl.searchParams.get("reviewId");
  if (!tenantId || !reviewId)
    return new NextResponse("Missing review selection", { status: 400 });
  const response = await adminApiRawGet(
    `/tenants/${encodeURIComponent(tenantId)}/access-governance/reviews/${encodeURIComponent(reviewId)}/export`,
  );
  if (!response.ok)
    return new NextResponse("Unable to export access review", {
      status: response.status,
    });
  return new NextResponse(await response.text(), {
    headers: {
      "Content-Disposition": `attachment; filename="access-review-${reviewId}.csv"`,
      "Content-Type": "text/csv; charset=utf-8",
    },
  });
}

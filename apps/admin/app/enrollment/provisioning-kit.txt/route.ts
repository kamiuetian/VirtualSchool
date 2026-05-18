import type { EnrollmentBatchSummary } from "@virtual-school/shared";
import { getAdminData } from "../../../lib/api";
import { formatDate } from "../../../lib/format";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const data = await getAdminData("/enrollment");
  const batchId = new URL(request.url).searchParams.get("batchId");

  if (!data.selectedTenant || !batchId) {
    return new Response("Enrollment batch not selected", { status: 404 });
  }

  const batch = data.enrollmentBatches.find((item) => item.id === batchId);

  if (!batch) {
    return new Response("Enrollment batch was not found", { status: 404 });
  }

  return new Response(enrollmentKitText(data.selectedTenant.name, batch), {
    headers: {
      "Content-Disposition": `attachment; filename="${safeFileName(batch.name)}-provisioning-kit.txt"`,
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}

function enrollmentKitText(
  schoolName: string,
  batch: EnrollmentBatchSummary,
): string {
  return [
    `${schoolName} Android Tablet Enrollment Kit`,
    "",
    `Batch: ${batch.name}`,
    `Status: ${batch.status}`,
    `Expires: ${formatDate(batch.expiresAt)}`,
    `Device cap: ${batch.maxDevices ?? "No cap"}`,
    `Already enrolled: ${batch.enrolledCount}`,
    `Enrollment key: ${maskToken(batch.token)}`,
    "",
    "Operator checklist:",
    "1. Factory reset or start from a supported school-owned Android tablet.",
    "2. Connect the tablet to a trusted setup network.",
    "3. Open the Android provisioning QR scanner during first-run setup.",
    "4. Scan the QR image downloaded from the enrollment batch card.",
    "5. Wait for managed setup to finish before assigning the device in the portal.",
    "6. Confirm the device appears in quarantine, then assign student, class, campus, and tags.",
    "",
    "Security notes:",
    "- Do not paste or share raw enrollment payload JSON.",
    "- Do not send enrollment QR images outside the implementation team.",
    "- Recreate the batch if a QR is exposed beyond the rollout group.",
    "- The portal masks the enrollment key by design; use the QR image for provisioning.",
  ].join("\n");
}

function maskToken(value: string): string {
  if (value.length <= 10) {
    return "Hidden";
  }

  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function safeFileName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

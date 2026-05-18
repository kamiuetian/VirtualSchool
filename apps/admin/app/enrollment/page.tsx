import { ClipboardList, QrCode } from "lucide-react";
import QRCode from "qrcode";
import type { EnrollmentBatchSummary } from "@virtual-school/shared";
import { AppShell } from "../../components/app-shell";
import {
  ActionPanel,
  EmptyState,
  Field,
  PageSection,
  StatCard,
  StatusPill,
  SubmitButton,
} from "../../components/ui";
import { createEnrollmentBatchAction } from "../../lib/actions";
import { getAdminData } from "../../lib/api";
import { formatCount, formatDate, humanize } from "../../lib/format";

export const dynamic = "force-dynamic";

export default async function EnrollmentPage() {
  const data = await getAdminData("/enrollment");
  const batchesWithQr = await Promise.all(
    data.enrollmentBatches.map(async (batch) => ({
      batch,
      qrDataUrl: await enrollmentQrDataUrl(batch),
    })),
  );
  const active = data.enrollmentBatches.filter(
    (batch) => batch.status === "ACTIVE",
  );
  const enrolled = data.enrollmentBatches.reduce(
    (total, batch) => total + batch.enrolledCount,
    0,
  );

  return (
    <AppShell
      connectionIssue={data.connectionIssue}
      tenant={data.selectedTenant}
    >
      <div className="content-stack">
        <PageSection kicker="Android setup" title="Enrollment Batches">
          <section className="stat-grid" aria-label="Enrollment summary">
            <StatCard
              label="Active batches"
              value={formatCount(active.length)}
            />
            <StatCard
              label="Total batches"
              value={formatCount(data.enrollmentBatches.length)}
            />
            <StatCard
              label="Devices enrolled from QR"
              tone="good"
              value={formatCount(enrolled)}
            />
            <StatCard
              label="Waiting assignment"
              value={formatCount(
                data.devices.filter(
                  (device) => !device.studentId && !device.classId,
                ).length,
              )}
            />
          </section>
        </PageSection>

        <PageSection title="QR Enrollment Flow">
          <div className="workflow-grid">
            {[
              "Create batch",
              "Print QR",
              "Enroll tablet",
              "Assign student",
              "Apply policy",
            ].map((step, index) => (
              <article className="workflow-step" key={step}>
                <span>{index + 1}</span>
                <strong>{step}</strong>
              </article>
            ))}
          </div>
        </PageSection>

        {data.selectedTenant ? (
          <PageSection kicker="Provisioning" title="Create Enrollment Batch">
            <ActionPanel title="New QR batch">
              <form
                action={createEnrollmentBatchAction}
                className="inline-form"
              >
                <input
                  name="tenantId"
                  type="hidden"
                  value={data.selectedTenant.id}
                />
                <Field label="Batch name">
                  <input
                    name="name"
                    placeholder="Grade 4 tablet rollout"
                    required
                  />
                </Field>
                <Field label="Device cap">
                  <input
                    min="1"
                    name="maxDevices"
                    placeholder="60"
                    type="number"
                  />
                </Field>
                <Field label="Expires">
                  <input name="expiresAt" type="datetime-local" />
                </Field>
                <SubmitButton>Create batch</SubmitButton>
              </form>
            </ActionPanel>
          </PageSection>
        ) : null}

        <PageSection title="Enrollment Batch Register">
          {data.enrollmentBatches.length > 0 ? (
            <div className="card-grid">
              {batchesWithQr.map(({ batch, qrDataUrl }) => {
                const capacityPercent = batch.maxDevices
                  ? Math.min(
                      Math.round(
                        (batch.enrolledCount / batch.maxDevices) * 100,
                      ),
                      100,
                    )
                  : 0;

                return (
                  <article
                    className="record-card enrollment-card"
                    key={batch.id}
                  >
                    <div className="enrollment-card-header">
                      <div className="record-icon">
                        <QrCode size={20} />
                      </div>
                      <StatusPill
                        tone={batch.status === "ACTIVE" ? "good" : "neutral"}
                      >
                        {humanize(batch.status)}
                      </StatusPill>
                    </div>
                    <div>
                      <strong>{batch.name}</strong>
                      <span>
                        {batch.enrolledCount} enrolled from this QR batch
                      </span>
                    </div>
                    <div className="qr-panel">
                      <img
                        alt={`Enrollment QR for ${batch.name}`}
                        height={192}
                        src={qrDataUrl}
                        width={192}
                      />
                      <div className="qr-actions">
                        <a
                          className="small-button primary"
                          download={`${safeFileName(batch.name)}-enrollment-qr.png`}
                          href={qrDataUrl}
                        >
                          Download QR
                        </a>
                        <a
                          className="small-button"
                          href={`/enrollment/provisioning-kit.txt?batchId=${encodeURIComponent(batch.id)}`}
                        >
                          Download kit
                        </a>
                      </div>
                    </div>
                    <dl>
                      <div>
                        <dt>Expires</dt>
                        <dd>{formatDate(batch.expiresAt)}</dd>
                      </div>
                      <div>
                        <dt>Limit</dt>
                        <dd>
                          {batch.maxDevices
                            ? formatCount(batch.maxDevices)
                            : "No cap"}
                        </dd>
                      </div>
                      <div>
                        <dt>Enrollment key</dt>
                        <dd>{maskToken(batch.token)}</dd>
                      </div>
                      <div>
                        <dt>Capacity used</dt>
                        <dd>
                          {batch.maxDevices
                            ? `${capacityPercent}%`
                            : `${formatCount(batch.enrolledCount)} enrolled`}
                        </dd>
                      </div>
                    </dl>
                    <div className="operator-note">
                      <ClipboardList size={16} />
                      <span>
                        Use the QR image for device provisioning. The enrollment
                        key is intentionally masked in the portal.
                      </span>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <EmptyState
              title="No enrollment batches"
              body="Enrollment batches will provide QR payloads for school-owned Android tablet provisioning."
            />
          )}
        </PageSection>
      </div>
    </AppShell>
  );
}

async function enrollmentQrDataUrl(
  batch: EnrollmentBatchSummary,
): Promise<string> {
  return QRCode.toDataURL(enrollmentQrText(batch), {
    errorCorrectionLevel: "M",
    margin: 2,
    scale: 8,
    type: "image/png",
  });
}

function enrollmentQrText(batch: EnrollmentBatchSummary): string {
  return JSON.stringify(batch.qrPayload);
}

function safeFileName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function maskToken(value: string): string {
  if (value.length <= 10) {
    return "Hidden";
  }

  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

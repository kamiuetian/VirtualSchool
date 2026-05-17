import { QrCode } from "lucide-react";
import { AppShell } from "../../components/app-shell";
import { EmptyState, PageSection, StatCard, StatusPill } from "../../components/ui";
import { getAdminData } from "../../lib/api";
import { formatCount, formatDate, humanize } from "../../lib/format";

export const dynamic = "force-dynamic";

export default async function EnrollmentPage() {
  const data = await getAdminData();
  const active = data.enrollmentBatches.filter((batch) => batch.status === "ACTIVE");
  const enrolled = data.enrollmentBatches.reduce(
    (total, batch) => total + batch.enrolledCount,
    0,
  );

  return (
    <AppShell connectionIssue={data.connectionIssue} tenant={data.selectedTenant}>
      <div className="content-stack">
        <PageSection kicker="Android setup" title="Enrollment Batches">
          <section className="stat-grid" aria-label="Enrollment summary">
            <StatCard label="Active batches" value={formatCount(active.length)} />
            <StatCard label="Total batches" value={formatCount(data.enrollmentBatches.length)} />
            <StatCard label="Devices enrolled from QR" tone="good" value={formatCount(enrolled)} />
            <StatCard label="Waiting assignment" value={formatCount(data.devices.filter((device) => !device.studentId && !device.classId).length)} />
          </section>
        </PageSection>

        <PageSection title="QR Enrollment Flow">
          <div className="workflow-grid">
            {["Create batch", "Print QR", "Enroll tablet", "Assign student", "Apply policy"].map(
              (step, index) => (
                <article className="workflow-step" key={step}>
                  <span>{index + 1}</span>
                  <strong>{step}</strong>
                </article>
              ),
            )}
          </div>
        </PageSection>

        <PageSection title="Enrollment Batch Register">
          {data.enrollmentBatches.length > 0 ? (
            <div className="card-grid">
              {data.enrollmentBatches.map((batch) => (
                <article className="record-card" key={batch.id}>
                  <div className="record-icon">
                    <QrCode size={20} />
                  </div>
                  <div>
                    <strong>{batch.name}</strong>
                    <span>{batch.enrolledCount} enrolled</span>
                  </div>
                  <StatusPill tone={batch.status === "ACTIVE" ? "good" : "neutral"}>
                    {humanize(batch.status)}
                  </StatusPill>
                  <dl>
                    <div>
                      <dt>Expires</dt>
                      <dd>{formatDate(batch.expiresAt)}</dd>
                    </div>
                    <div>
                      <dt>Limit</dt>
                      <dd>{batch.maxDevices ? formatCount(batch.maxDevices) : "No cap"}</dd>
                    </div>
                  </dl>
                </article>
              ))}
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

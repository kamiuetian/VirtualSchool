import { AppShell } from "../../components/app-shell";
import { EmptyState, PageSection, StatusPill } from "../../components/ui";
import { getGuardianDashboard } from "../../lib/api";
import { formatDateTime, humanize } from "../../lib/format";

export const dynamic = "force-dynamic";

export default async function GuardianPage() {
  const { dashboard, connectionIssue } = await getGuardianDashboard();
  return (
    <AppShell connectionIssue={connectionIssue} tenant={null}>
      <div className="content-stack">
        <section className="hero-panel">
          <div>
            <span className="eyebrow">Guardian view</span>
            <h2>
              {dashboard
                ? `Welcome, ${dashboard.guardianName}.`
                : "Your family learning view"}
            </h2>
            <p>
              {dashboard?.privacyMessage ??
                "Linked-child information will appear after your school connects your account."}
            </p>
          </div>
        </section>
        {!dashboard ? (
          <EmptyState
            title="Guardian profile unavailable"
            body="Confirm that your sign-in email is linked to a student by your school."
          />
        ) : dashboard.children.length === 0 ? (
          <EmptyState
            title="No linked children"
            body="Ask the school roster administrator to review your guardian link."
          />
        ) : (
          dashboard.children.map((child) => (
            <PageSection
              key={child.id}
              kicker={`${child.grade}${child.section ? ` · ${child.section}` : ""}`}
              title={child.name}
            >
              <div className="stat-grid">
                <article className="stat-card">
                  <span>Device availability</span>
                  <strong>{humanize(child.device.availability)}</strong>
                  <small>
                    {child.device.lastSeenAt
                      ? `Last seen ${formatDateTime(child.device.lastSeenAt)}`
                      : "No check-in shared"}
                  </small>
                </article>
                <article className="stat-card">
                  <span>Expected mode</span>
                  <strong>{humanize(child.expectedMode)}</strong>
                  <small>Based on school schedule and active class mode</small>
                </article>
                <article className="stat-card">
                  <span>School hours</span>
                  <strong>{child.schoolHours.length}</strong>
                  <small>Scheduled blocks this week</small>
                </article>
              </div>
              <h3>Recently approved learning access</h3>
              {child.approvedLearningAccess.length ? (
                <div className="list-panel">
                  {child.approvedLearningAccess.map((item, index) => (
                    <article
                      className="list-row"
                      key={`${item.approvedAt}-${index}`}
                    >
                      <div>
                        <strong>{item.label}</strong>
                        <span>Approved {formatDateTime(item.approvedAt)}</span>
                      </div>
                      <StatusPill tone="good">{humanize(item.type)}</StatusPill>
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="No recent approved access"
                  body="Teacher-approved resources and temporary websites will appear here without exposing browsing history."
                />
              )}
            </PageSection>
          ))
        )}
      </div>
    </AppShell>
  );
}

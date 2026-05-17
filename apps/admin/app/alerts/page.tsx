import { AppShell } from "../../components/app-shell";
import {
  EmptyState,
  Field,
  PageSection,
  StatCard,
  StatusPill,
  SubmitButton,
} from "../../components/ui";
import {
  acknowledgeAlertAction,
  resolveAlertAction,
  scanOfflineAlertsAction,
} from "../../lib/actions";
import { getAdminData } from "../../lib/api";
import { formatCount, formatDateTime, humanize } from "../../lib/format";

export const dynamic = "force-dynamic";

export default async function AlertsPage() {
  const data = await getAdminData();
  const selectedTenant = data.selectedTenant;
  const open = data.alerts.filter((alert) => alert.status === "OPEN");
  const critical = data.alerts.filter((alert) => alert.severity === "CRITICAL");

  return (
    <AppShell connectionIssue={data.connectionIssue} tenant={selectedTenant}>
      <div className="content-stack">
        <PageSection kicker="Supportability" title="Alerts And Diagnostics">
          <section className="stat-grid" aria-label="Alert summary">
            <StatCard label="Visible alerts" value={formatCount(data.alerts.length)} />
            <StatCard label="Open" tone={open.length > 0 ? "warning" : "good"} value={formatCount(open.length)} />
            <StatCard label="Critical" tone={critical.length > 0 ? "critical" : "good"} value={formatCount(critical.length)} />
            <StatCard label="Offline devices" value={formatCount(data.devices.filter((device) => device.status === "OFFLINE").length)} />
          </section>
        </PageSection>

        {selectedTenant ? (
          <PageSection kicker="Alert action" title="Offline Detection">
            <div className="action-panel">
              <h3>Scan check-in threshold</h3>
              <form action={scanOfflineAlertsAction} className="inline-form compact-action">
                <input name="tenantId" type="hidden" value={selectedTenant.id} />
                <Field label="Offline after minutes">
                  <input
                    defaultValue="60"
                    max="10080"
                    min="5"
                    name="offlineAfterMinutes"
                    type="number"
                  />
                </Field>
                <SubmitButton>Run scan</SubmitButton>
              </form>
            </div>
          </PageSection>
        ) : null}

        <PageSection title="Alert Queue">
          {data.alerts.length > 0 ? (
            <div className="list-panel">
              {data.alerts.map((alert) => (
                <article className="list-row" key={alert.id}>
                  <div>
                    <strong>{alert.title}</strong>
                    <span>{alert.message}</span>
                    <small>{formatDateTime(alert.lastSeenAt)}</small>
                  </div>
                  <div className="row-actions">
                    <StatusPill tone={alert.severity === "CRITICAL" ? "critical" : "warning"}>
                      {humanize(alert.severity)}
                    </StatusPill>
                    <StatusPill tone={alert.status === "RESOLVED" ? "good" : "neutral"}>
                      {humanize(alert.status)}
                    </StatusPill>
                    {selectedTenant && alert.status !== "RESOLVED" ? (
                      <form action={acknowledgeAlertAction} className="row-form">
                        <input name="tenantId" type="hidden" value={selectedTenant.id} />
                        <input name="alertId" type="hidden" value={alert.id} />
                        <Field label="Reason">
                          <input name="reason" placeholder="Reviewed by IT" />
                        </Field>
                        <button className="small-button" type="submit">
                          Acknowledge
                        </button>
                      </form>
                    ) : null}
                    {selectedTenant && alert.status !== "RESOLVED" ? (
                      <form action={resolveAlertAction} className="row-form">
                        <input name="tenantId" type="hidden" value={selectedTenant.id} />
                        <input name="alertId" type="hidden" value={alert.id} />
                        <Field label="Resolution">
                          <input name="reason" placeholder="Issue resolved" />
                        </Field>
                        <button className="small-button primary" type="submit">
                          Resolve
                        </button>
                      </form>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No alerts in queue"
              body="Offline, low battery, storage, compliance, policy, and app deployment alerts will appear here."
            />
          )}
        </PageSection>
      </div>
    </AppShell>
  );
}

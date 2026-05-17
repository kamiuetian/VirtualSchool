import { AppShell } from "../../components/app-shell";
import {
  EmptyState,
  Field,
  PageSection,
  StatCard,
  StatusPill,
} from "../../components/ui";
import { acknowledgeAlertAction, resolveAlertAction } from "../../lib/actions";
import { getAdminData } from "../../lib/api";
import { formatCount, formatDateTime, humanize } from "../../lib/format";

export const dynamic = "force-dynamic";

export default async function AlertsPage() {
  const data = await getAdminData();
  const open = data.alerts.filter((alert) => alert.status === "OPEN");
  const critical = data.alerts.filter((alert) => alert.severity === "CRITICAL");

  return (
    <AppShell connectionIssue={data.connectionIssue} tenant={data.selectedTenant}>
      <div className="content-stack">
        <PageSection kicker="Supportability" title="Alerts And Diagnostics">
          <section className="stat-grid" aria-label="Alert summary">
            <StatCard label="Visible alerts" value={formatCount(data.alerts.length)} />
            <StatCard label="Open" tone={open.length > 0 ? "warning" : "good"} value={formatCount(open.length)} />
            <StatCard label="Critical" tone={critical.length > 0 ? "critical" : "good"} value={formatCount(critical.length)} />
            <StatCard label="Offline devices" value={formatCount(data.devices.filter((device) => device.status === "OFFLINE").length)} />
          </section>
        </PageSection>

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
                    {data.selectedTenant && alert.status !== "RESOLVED" ? (
                      <form action={acknowledgeAlertAction} className="row-form">
                        <input name="tenantId" type="hidden" value={data.selectedTenant.id} />
                        <input name="alertId" type="hidden" value={alert.id} />
                        <Field label="Reason">
                          <input name="reason" placeholder="Reviewed by IT" />
                        </Field>
                        <button className="small-button" type="submit">
                          Acknowledge
                        </button>
                      </form>
                    ) : null}
                    {data.selectedTenant && alert.status !== "RESOLVED" ? (
                      <form action={resolveAlertAction} className="row-form">
                        <input name="tenantId" type="hidden" value={data.selectedTenant.id} />
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

import { AppShell } from "../components/app-shell";
import { EmptyState, PageSection, ProgressBar, StatCard, StatusPill } from "../components/ui";
import { getAdminData } from "../lib/api";
import { formatCount, formatDateTime, humanize } from "../lib/format";

export const dynamic = "force-dynamic";

export default async function Home() {
  const data = await getAdminData("/");
  const openAlerts = data.alerts.filter((alert) => alert.status !== "RESOLVED");
  const onlineDevices = data.devices.filter((device) => device.status === "ONLINE");
  const policyCompletion = data.onboarding
    ? Math.round((data.onboarding.completedCount / data.onboarding.totalCount) * 100)
    : 0;

  return (
    <AppShell connectionIssue={data.connectionIssue} tenant={data.selectedTenant}>
      <div className="content-stack">
        <section className="hero-panel">
          <div>
            <span className="eyebrow">Learning fleet command center</span>
            <h2>Keep every school tablet ready for class.</h2>
            <p>
              Monitor enrollment, policy delivery, app access, device health,
              support queues, and plan usage from one tenant-scoped console.
            </p>
          </div>
          <div className="hero-signal" aria-label="Operations readiness">
            <strong>{policyCompletion}%</strong>
            <span>School readiness</span>
            <ProgressBar
              tone={policyCompletion >= 80 ? "good" : "warning"}
              value={policyCompletion}
            />
          </div>
        </section>

        <section className="stat-grid" aria-label="Operational summary">
          <StatCard label="Managed tablets" value={formatCount(data.devices.length)} />
          <StatCard
            label="Online now"
            tone="good"
            value={formatCount(onlineDevices.length)}
          />
          <StatCard
            label="Open alerts"
            tone={openAlerts.length > 0 ? "warning" : "good"}
            value={formatCount(openAlerts.length)}
          />
          <StatCard
            label="Published policies"
            value={formatCount(
              data.policies.filter((policy) => policy.status === "PUBLISHED").length,
            )}
          />
        </section>

        <PageSection kicker="Setup" title="School Readiness">
          {data.onboarding ? (
            <div className="checklist-grid">
              {data.onboarding.items.map((item) => (
                <article className="check-item" key={item.key}>
                  <span className={item.completed ? "check-dot done" : "check-dot"} />
                  <div>
                    <strong>{item.label}</strong>
                    <span>{item.completed ? "Complete" : "Needs attention"}</span>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No school tenant selected"
              body="Create or connect a school tenant to begin onboarding devices and staff."
            />
          )}
        </PageSection>

        <PageSection kicker="Alerts" title="Device Health And Support">
          {openAlerts.length > 0 ? (
            <div className="list-panel">
              {openAlerts.slice(0, 5).map((alert) => (
                <article className="list-row" key={alert.id}>
                  <div>
                    <strong>{alert.title}</strong>
                    <span>{alert.message}</span>
                  </div>
                  <StatusPill tone={alert.severity === "CRITICAL" ? "critical" : "warning"}>
                    {humanize(alert.severity)}
                  </StatusPill>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No open device alerts"
              body="Device health, compliance, and deployment alerts will appear here as the fleet checks in."
            />
          )}
        </PageSection>

        <PageSection kicker="Billing" title="Plan Usage Snapshot">
          {data.billingUsage ? (
            <div className="usage-grid">
              {data.billingUsage.metrics.slice(0, 4).map((metric) => (
                <article className="usage-card" key={metric.key}>
                  <div>
                    <strong>{metric.label}</strong>
                    <span>
                      {formatCount(metric.used)} of{" "}
                      {metric.limit === null ? "unlimited" : formatCount(metric.limit)}
                    </span>
                  </div>
                  <ProgressBar
                    tone={metric.overLimit ? "critical" : (metric.percentUsed ?? 0) >= 80 ? "warning" : "good"}
                    value={Math.min(metric.percentUsed ?? 0, 100)}
                  />
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Plan usage is not available"
              body="Usage totals appear after a school tenant has an active billing profile."
            />
          )}
        </PageSection>

        <PageSection kicker="Recent fleet activity" title="Latest Enrollments">
          {data.devices.length > 0 ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Serial</th>
                    <th>Model</th>
                    <th>Status</th>
                    <th>Last check-in</th>
                  </tr>
                </thead>
                <tbody>
                  {data.devices.slice(0, 6).map((device) => (
                    <tr key={device.id}>
                      <td>{device.serialNumber}</td>
                      <td>{device.model ?? device.manufacturer ?? "Android tablet"}</td>
                      <td>
                        <StatusPill tone={device.status === "ONLINE" ? "good" : "neutral"}>
                          {humanize(device.status)}
                        </StatusPill>
                      </td>
                      <td>{formatDateTime(device.lastCheckInAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title="No tablets enrolled"
              body="Enrollment batches and managed Android check-ins will populate this view."
            />
          )}
        </PageSection>
      </div>
    </AppShell>
  );
}

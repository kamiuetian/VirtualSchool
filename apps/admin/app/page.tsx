import { AppShell } from "../components/app-shell";
import Link from "next/link";
import {
  EmptyState,
  Field,
  PageSection,
  ProgressBar,
  StatCard,
  StatusPill,
  SubmitButton,
} from "../components/ui";
import {
  completeOnboardingAction,
  createPilotFeedbackAction,
} from "../lib/actions";
import { getAdminData } from "../lib/api";
import { roleCan } from "../lib/auth/portal-access";
import { formatCount, formatDateTime, humanize } from "../lib/format";

export const dynamic = "force-dynamic";

export default async function Home() {
  const data = await getAdminData("/");
  const canReadDevices = roleCan(data.session.role, "device:read");
  const canManagePolicies = roleCan(data.session.role, "policy:manage");
  const canReadBilling = roleCan(data.session.role, "billing:read");
  const canViewSchoolReadiness =
    roleCan(data.session.role, "tenant:update") ||
    roleCan(data.session.role, "roster:manage") ||
    roleCan(data.session.role, "device:enroll") ||
    canManagePolicies;
  const openAlerts = data.alerts.filter((alert) => alert.status !== "RESOLVED");
  const onlineDevices = data.devices.filter(
    (device) => device.status === "ONLINE",
  );
  const policyCompletion = data.onboarding
    ? Math.round(
        (data.onboarding.completedCount / data.onboarding.totalCount) * 100,
      )
    : 0;

  return (
    <AppShell
      connectionIssue={data.connectionIssue}
      tenant={data.selectedTenant}
    >
      <div className="content-stack">
        <section className="hero-panel">
          <div>
            <span className="eyebrow">
              {canViewSchoolReadiness
                ? "Learning fleet command center"
                : "Role-based workspace"}
            </span>
            <h2>
              {canViewSchoolReadiness
                ? "Keep every school tablet ready for class."
                : `Welcome back, ${data.session.name}.`}
            </h2>
            <p>
              {canViewSchoolReadiness
                ? "Monitor enrollment, policy delivery, app access, device health, support queues, and plan usage from one tenant-scoped console."
                : `This dashboard only shows the school information and tools assigned to your ${humanize(data.session.role).toLowerCase()} role.`}
            </p>
          </div>
          {canViewSchoolReadiness ? (
            <div className="hero-signal" aria-label="Operations readiness">
              <strong>{policyCompletion}%</strong>
              <span>School readiness</span>
              <ProgressBar
                tone={policyCompletion >= 80 ? "good" : "warning"}
                value={policyCompletion}
              />
            </div>
          ) : null}
        </section>

        {data.selectedTenant ? (
          <PageSection kicker="Pilot updates" title="School Announcements">
            {data.announcements.length ? (
              <div className="list-panel">
                {data.announcements.map((item) => (
                  <article className="list-row" key={item.id}>
                    <div>
                      <strong>{item.title}</strong>
                      <span>{item.message}</span>
                      <small>{formatDateTime(item.startsAt)}</small>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState
                title="No current announcements"
                body="Role-targeted school updates will appear here during their scheduled window."
              />
            )}
            <form
              action={createPilotFeedbackAction}
              className="action-panel inline-form"
            >
              <input
                name="tenantId"
                type="hidden"
                value={data.selectedTenant.id}
              />
              <Field label="Module">
                <input name="module" required placeholder="Attendance" />
              </Field>
              <Field label="Severity">
                <select name="severity">
                  <option>LOW</option>
                  <option>MEDIUM</option>
                  <option>HIGH</option>
                  <option>CRITICAL</option>
                </select>
              </Field>
              <Field label="Privacy-safe pilot feedback">
                <input
                  name="summary"
                  required
                  placeholder="Do not include names or device identifiers"
                />
              </Field>
              <SubmitButton>Send pilot feedback</SubmitButton>
            </form>
          </PageSection>
        ) : null}

        <section className="stat-grid" aria-label="Operational summary">
          {canReadDevices ? (
            <>
              <StatCard
                label="Managed tablets"
                value={formatCount(data.devices.length)}
              />
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
            </>
          ) : null}
          {canManagePolicies ? (
            <StatCard
              label="Published policies"
              value={formatCount(
                data.policies.filter((policy) => policy.status === "PUBLISHED")
                  .length,
              )}
            />
          ) : null}
        </section>

        {canViewSchoolReadiness ? (
          <PageSection kicker="Setup" title="School Readiness">
            {data.onboarding ? (
              <div className="content-stack">
                <div
                  className={
                    data.onboarding.readyForFirstEnrollment
                      ? "readiness-callout ready"
                      : "readiness-callout"
                  }
                >
                  <strong>
                    {data.onboarding.readyForFirstEnrollment
                      ? "Ready for first enrollment"
                      : "Enrollment readiness checks remain"}
                  </strong>
                  <span>
                    {data.onboarding.readyForFirstEnrollment
                      ? "The tenant has the profile, roster, policy, app, and active batch required for a pilot device."
                      : `Finish: ${data.onboarding.readinessIssues.join(", ")}.`}
                  </span>
                </div>
                <div className="checklist-grid">
                  {data.onboarding.items.map((item) => (
                    <article className="check-item" key={item.key}>
                      <span
                        className={
                          item.completed ? "check-dot done" : "check-dot"
                        }
                      />
                      <div>
                        <strong>{item.label}</strong>
                        <span>{item.description}</span>
                        <Link className="context-link" href={item.href}>
                          {item.completed ? "Review step" : "Complete step"}
                        </Link>
                      </div>
                    </article>
                  ))}
                </div>
                {data.onboarding.completedAt ? (
                  <p className="completion-note">
                    Onboarding finished{" "}
                    {formatDateTime(data.onboarding.completedAt)}.
                  </p>
                ) : roleCan(data.session.role, "tenant:update") ? (
                  <form action={completeOnboardingAction}>
                    <input
                      name="tenantId"
                      type="hidden"
                      value={data.onboarding.tenantId}
                    />
                    <button
                      className="submit-button"
                      disabled={
                        data.onboarding.completedCount !==
                        data.onboarding.totalCount
                      }
                      type="submit"
                    >
                      Finish onboarding
                    </button>
                  </form>
                ) : null}
              </div>
            ) : (
              <EmptyState
                title="No school tenant selected"
                body="Create or connect a school tenant to begin onboarding devices and staff."
              />
            )}
          </PageSection>
        ) : null}

        {canReadDevices ? (
          <PageSection kicker="Alerts" title="Device Health And Support">
            {openAlerts.length > 0 ? (
              <div className="list-panel">
                {openAlerts.slice(0, 5).map((alert) => (
                  <article className="list-row" key={alert.id}>
                    <div>
                      <strong>{alert.title}</strong>
                      <span>{alert.message}</span>
                    </div>
                    <StatusPill
                      tone={
                        alert.severity === "CRITICAL" ? "critical" : "warning"
                      }
                    >
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
        ) : null}

        {canReadBilling ? (
          <PageSection kicker="Billing" title="Plan Usage Snapshot">
            {data.billingUsage ? (
              <div className="usage-grid">
                {data.billingUsage.metrics.slice(0, 4).map((metric) => (
                  <article className="usage-card" key={metric.key}>
                    <div>
                      <strong>{metric.label}</strong>
                      <span>
                        {formatCount(metric.used)} of{" "}
                        {metric.limit === null
                          ? "unlimited"
                          : formatCount(metric.limit)}
                      </span>
                    </div>
                    <ProgressBar
                      tone={
                        metric.overLimit
                          ? "critical"
                          : (metric.percentUsed ?? 0) >= 80
                            ? "warning"
                            : "good"
                      }
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
        ) : null}

        {canReadDevices ? (
          <PageSection
            kicker="Recent fleet activity"
            title="Latest Enrollments"
          >
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
                        <td>
                          {device.model ??
                            device.manufacturer ??
                            "Android tablet"}
                        </td>
                        <td>
                          <StatusPill
                            tone={
                              device.status === "ONLINE" ? "good" : "neutral"
                            }
                          >
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
        ) : null}
      </div>
    </AppShell>
  );
}

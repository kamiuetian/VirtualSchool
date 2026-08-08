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
  updateNotificationPreferencesAction,
  createAutomationRuleAction,
  updateAutomationRuleAction,
  testAutomationRuleAction,
} from "../../lib/actions";
import { getAdminData } from "../../lib/api";
import { roleCan } from "../../lib/auth/portal-access";
import { formatCount, formatDateTime, humanize } from "../../lib/format";

export const dynamic = "force-dynamic";

export default async function AlertsPage() {
  const data = await getAdminData("/alerts");
  const selectedTenant = data.selectedTenant;
  const canManageAlerts = roleCan(data.session.role, "device:command");
  const open = data.alerts.filter((alert) => alert.status === "OPEN");
  const critical = data.alerts.filter((alert) => alert.severity === "CRITICAL");
  const preferences = data.notificationPreferences;

  return (
    <AppShell connectionIssue={data.connectionIssue} tenant={selectedTenant}>
      <div className="content-stack">
        <PageSection kicker="Supportability" title="Alerts And Diagnostics">
          <section className="stat-grid" aria-label="Alert summary">
            <StatCard
              label="Visible alerts"
              value={formatCount(data.alerts.length)}
            />
            <StatCard
              label="Open"
              tone={open.length > 0 ? "warning" : "good"}
              value={formatCount(open.length)}
            />
            <StatCard
              label="Critical"
              tone={critical.length > 0 ? "critical" : "good"}
              value={formatCount(critical.length)}
            />
            <StatCard
              label="Offline devices"
              value={formatCount(
                data.devices.filter((device) => device.status === "OFFLINE")
                  .length,
              )}
            />
          </section>
        </PageSection>

        {selectedTenant && canManageAlerts ? (
          <PageSection kicker="Alert action" title="Offline Detection">
            <div className="action-panel">
              <h3>Scan check-in threshold</h3>
              <form
                action={scanOfflineAlertsAction}
                className="inline-form compact-action"
              >
                <input
                  name="tenantId"
                  type="hidden"
                  value={selectedTenant.id}
                />
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

        {selectedTenant && roleCan(data.session.role, "tenant:update") ? (
          <PageSection kicker="Bounded workflows" title="Automation Rules">
            <form
              action={createAutomationRuleAction}
              className="action-panel content-stack"
            >
              <input name="tenantId" type="hidden" value={selectedTenant.id} />
              <div className="inline-form">
                <Field label="Rule name">
                  <input name="name" required />
                </Field>
                <Field label="Trigger">
                  <select name="trigger">
                    <option value="DEVICE_OFFLINE">Device offline</option>
                    <option value="POLICY_FAILURE_REPEATED">
                      Repeated policy failure
                    </option>
                  </select>
                </Field>
                <Field label="Threshold">
                  <input
                    name="threshold"
                    type="number"
                    min="1"
                    max="20"
                    defaultValue="1"
                  />
                </Field>
                <Field label="Window minutes">
                  <input
                    name="windowMinutes"
                    type="number"
                    min="5"
                    max="10080"
                    defaultValue="60"
                  />
                </Field>
                <Field label="Action">
                  <select name="automationAction">
                    <option value="NOTIFY">Notify</option>
                    <option value="CREATE_TICKET">Create support item</option>
                  </select>
                </Field>
                <Field label="Title">
                  <input name="title" required />
                </Field>
                <Field label="Severity">
                  <select name="severity">
                    <option>WARNING</option>
                    <option>INFO</option>
                    <option>CRITICAL</option>
                  </select>
                </Field>
              </div>
              <SubmitButton>Create disabled rule</SubmitButton>
            </form>
            <div className="list-panel">
              {data.automationRules.map((rule) => (
                <article className="list-row" key={rule.id}>
                  <div>
                    <strong>{rule.name}</strong>
                    <span>
                      {humanize(rule.trigger)} → {humanize(rule.action)} ·{" "}
                      {rule.conditions.threshold} in{" "}
                      {rule.conditions.windowMinutes} minutes
                    </span>
                  </div>
                  <div className="row-actions">
                    <StatusPill tone={rule.enabled ? "good" : "neutral"}>
                      {rule.enabled ? "Enabled" : "Disabled"}
                    </StatusPill>
                    <form action={testAutomationRuleAction}>
                      <input
                        type="hidden"
                        name="tenantId"
                        value={selectedTenant.id}
                      />
                      <input type="hidden" name="ruleId" value={rule.id} />
                      <button className="small-button">Test safely</button>
                    </form>
                    <form action={updateAutomationRuleAction}>
                      {Object.entries({
                        tenantId: selectedTenant.id,
                        ruleId: rule.id,
                        name: rule.name,
                        trigger: rule.trigger,
                        threshold: rule.conditions.threshold,
                        windowMinutes: rule.conditions.windowMinutes,
                        automationAction: rule.action,
                        title: rule.actionConfig.title,
                        severity: rule.actionConfig.severity,
                      }).map(([name, value]) => (
                        <input
                          key={name}
                          type="hidden"
                          name={name}
                          value={String(value)}
                        />
                      ))}
                      <input
                        type="hidden"
                        name="enabled"
                        value={String(!rule.enabled)}
                      />
                      <button className="small-button">
                        {rule.enabled ? "Disable" : "Enable"}
                      </button>
                    </form>
                  </div>
                </article>
              ))}
            </div>
          </PageSection>
        ) : null}

        {selectedTenant && roleCan(data.session.role, "tenant:update") ? (
          <PageSection kicker="Email delivery" title="Notification Preferences">
            <form
              action={updateNotificationPreferencesAction}
              className="action-panel content-stack"
            >
              <input name="tenantId" type="hidden" value={selectedTenant.id} />
              <Field label="Recipients (comma separated)">
                <input
                  defaultValue={preferences?.recipients.join(", ") ?? ""}
                  name="recipients"
                  placeholder="it@example.edu, safeguarding@example.edu"
                  required
                />
              </Field>
              <div className="inline-form">
                <Field label="Offline threshold (minutes)">
                  <input
                    defaultValue={preferences?.offlineAfterMinutes ?? 60}
                    min="5"
                    max="10080"
                    name="offlineAfterMinutes"
                    type="number"
                  />
                </Field>
                <Field label="Repeated enrollment threshold">
                  <input
                    defaultValue={preferences?.repeatedEnrollmentThreshold ?? 3}
                    min="2"
                    max="100"
                    name="repeatedEnrollmentThreshold"
                    type="number"
                  />
                </Field>
                <Field label="Deduplication window (minutes)">
                  <input
                    defaultValue={preferences?.deduplicationWindowMinutes ?? 60}
                    min="5"
                    max="10080"
                    name="deduplicationWindowMinutes"
                    type="number"
                  />
                </Field>
                <Field label="Missed sessions in 7 days">
                  <input
                    defaultValue={preferences?.missedSessionThreshold ?? 3}
                    min="2"
                    max="20"
                    name="missedSessionThreshold"
                    type="number"
                  />
                </Field>
                <Field label="Policy failures in 7 days">
                  <input
                    defaultValue={preferences?.complianceFailureThreshold ?? 3}
                    min="2"
                    max="20"
                    name="complianceFailureThreshold"
                    type="number"
                  />
                </Field>
              </div>
              <div className="inline-form">
                {[
                  [
                    "offlineEnabled",
                    "Offline",
                    preferences?.offlineEnabled ?? true,
                  ],
                  [
                    "policyFailureEnabled",
                    "Policy failures",
                    preferences?.policyFailureEnabled ?? true,
                  ],
                  [
                    "appFailureEnabled",
                    "App failures",
                    preferences?.appFailureEnabled ?? true,
                  ],
                  [
                    "lostDeviceEnabled",
                    "Lost device",
                    preferences?.lostDeviceEnabled ?? true,
                  ],
                  [
                    "repeatedEnrollmentEnabled",
                    "Repeated enrollment",
                    preferences?.repeatedEnrollmentEnabled ?? true,
                  ],
                  [
                    "engagementRiskEnabled",
                    "Engagement-risk alerts",
                    preferences?.engagementRiskEnabled ?? true,
                  ],
                  [
                    "weeklyAdminSummaryEnabled",
                    "Weekly admin summary",
                    preferences?.weeklyAdminSummaryEnabled ?? true,
                  ],
                  [
                    "weeklyGuardianSummaryEnabled",
                    "Guardian summaries (linked children only)",
                    preferences?.weeklyGuardianSummaryEnabled ?? false,
                  ],
                ].map(([name, label, checked]) => (
                  <label key={String(name)}>
                    <input
                      defaultChecked={Boolean(checked)}
                      name={String(name)}
                      type="checkbox"
                    />{" "}
                    {String(label)}
                  </label>
                ))}
              </div>
              <SubmitButton>Save notification preferences</SubmitButton>
            </form>
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
                    <StatusPill
                      tone={
                        alert.severity === "CRITICAL" ? "critical" : "warning"
                      }
                    >
                      {humanize(alert.severity)}
                    </StatusPill>
                    <StatusPill
                      tone={alert.status === "RESOLVED" ? "good" : "neutral"}
                    >
                      {humanize(alert.status)}
                    </StatusPill>
                    {selectedTenant &&
                    canManageAlerts &&
                    alert.status !== "RESOLVED" ? (
                      <form
                        action={acknowledgeAlertAction}
                        className="row-form"
                      >
                        <input
                          name="tenantId"
                          type="hidden"
                          value={selectedTenant.id}
                        />
                        <input name="alertId" type="hidden" value={alert.id} />
                        <Field label="Reason">
                          <input name="reason" placeholder="Reviewed by IT" />
                        </Field>
                        <button className="small-button" type="submit">
                          Acknowledge
                        </button>
                      </form>
                    ) : null}
                    {selectedTenant &&
                    canManageAlerts &&
                    alert.status !== "RESOLVED" ? (
                      <form action={resolveAlertAction} className="row-form">
                        <input
                          name="tenantId"
                          type="hidden"
                          value={selectedTenant.id}
                        />
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

        {data.notificationDeliveries.length > 0 ? (
          <PageSection title="Email Delivery Outcomes">
            <div className="list-panel">
              {data.notificationDeliveries.map((delivery) => (
                <article className="list-row" key={delivery.id}>
                  <div>
                    <strong>{delivery.recipient}</strong>
                    <span>Alert {delivery.alertId}</span>
                    <small>
                      {formatDateTime(delivery.createdAt)} ·{" "}
                      {delivery.attemptCount} attempt(s)
                    </small>
                  </div>
                  <div className="row-actions">
                    <StatusPill
                      tone={
                        delivery.status === "DELIVERED"
                          ? "good"
                          : delivery.status === "FAILED"
                            ? "critical"
                            : "neutral"
                      }
                    >
                      {humanize(delivery.status)}
                    </StatusPill>
                    {delivery.failureReason ? (
                      <small>{delivery.failureReason}</small>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          </PageSection>
        ) : null}
      </div>
    </AppShell>
  );
}

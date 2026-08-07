import { AppShell } from "../../components/app-shell";
import {
  ActionPanel,
  EmptyState,
  Field,
  PageSection,
  StatusPill,
  SubmitButton,
} from "../../components/ui";
import { getGuardianDashboard } from "../../lib/api";
import {
  acceptGuardianConsentAction,
  createGuardianSupportRequestAction,
  reportGuardianLostDeviceAction,
  updateGuardianNotificationsAction,
  updateGuardianAfterSchoolAction,
} from "../../lib/actions";
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
          <>
            <PageSection
              kicker="Family preferences"
              title="Consent and notifications"
            >
              <div className="two-column-grid">
                <ActionPanel title="Required forms">
                  {dashboard.consentForms.length ? (
                    dashboard.consentForms.map((form) => (
                      <form
                        action={acceptGuardianConsentAction}
                        className="form-grid"
                        key={form.id}
                      >
                        <input
                          type="hidden"
                          name="tenantId"
                          value={dashboard.tenantId}
                        />
                        <input type="hidden" name="noticeId" value={form.id} />
                        <strong>
                          {form.title} · version {form.version}
                        </strong>
                        <p>{form.content}</p>
                        {form.accepted ? (
                          <StatusPill tone="good">Accepted</StatusPill>
                        ) : (
                          <SubmitButton>Accept this version</SubmitButton>
                        )}
                      </form>
                    ))
                  ) : (
                    <p>No guardian forms are currently awaiting review.</p>
                  )}
                </ActionPanel>
                <ActionPanel title="Notification channels">
                  <form
                    action={updateGuardianNotificationsAction}
                    className="form-grid"
                  >
                    <input
                      type="hidden"
                      name="tenantId"
                      value={dashboard.tenantId}
                    />
                    {dashboard.supportedNotificationChannels.map((channel) => (
                      <label className="checkbox-row" key={channel}>
                        <input
                          type="checkbox"
                          name="channels"
                          value={channel}
                          defaultChecked={dashboard.notificationChannels.includes(
                            channel,
                          )}
                        />{" "}
                        {humanize(channel)}
                      </label>
                    ))}
                    <small>
                      Only contact methods registered with the school are
                      available.
                    </small>
                    <SubmitButton>Save notification channels</SubmitButton>
                  </form>
                </ActionPanel>
              </div>
            </PageSection>
            {dashboard.children.map((child) => (
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
                    <small>
                      Based on school schedule and active class mode
                    </small>
                  </article>
                  <article className="stat-card">
                    <span>School hours</span>
                    <strong>{child.schoolHours.length}</strong>
                    <small>Scheduled blocks this week</small>
                  </article>
                </div>
                <div className="two-column-grid">
                  <ActionPanel title="After-school learning choices">
                    <form
                      action={updateGuardianAfterSchoolAction}
                      className="form-grid"
                    >
                      <input
                        type="hidden"
                        name="tenantId"
                        value={dashboard.tenantId}
                      />
                      <input type="hidden" name="studentId" value={child.id} />
                      <label className="checkbox-row">
                        <input
                          type="checkbox"
                          name="enabled"
                          defaultChecked={child.afterSchoolControl.enabled}
                        />{" "}
                        Enable after-school choices
                      </label>
                      <Field label="Daily limit (minutes)">
                        <input
                          type="number"
                          name="dailyLimitMinutes"
                          min={15}
                          max={240}
                          defaultValue={
                            child.afterSchoolControl.dailyLimitMinutes
                          }
                          required
                        />
                      </Field>
                      <fieldset>
                        <legend>School-approved apps</legend>
                        {child.availableAfterSchoolApps.map((app) => (
                          <label className="checkbox-row" key={app.id}>
                            <input
                              type="checkbox"
                              name="allowedAppIds"
                              value={app.id}
                              defaultChecked={child.afterSchoolControl.allowedAppIds.includes(
                                app.id,
                              )}
                            />{" "}
                            {app.name}
                          </label>
                        ))}
                      </fieldset>
                      <small>
                        {child.afterSchoolControl.effective
                          ? "Active now during after-school mode."
                          : child.afterSchoolControl.inactiveReason}
                      </small>
                      <SubmitButton>Save choices</SubmitButton>
                    </form>
                  </ActionPanel>
                  <ActionPanel title="Report a missing device">
                    <form
                      action={reportGuardianLostDeviceAction}
                      className="form-grid"
                    >
                      <input
                        type="hidden"
                        name="tenantId"
                        value={dashboard.tenantId}
                      />
                      <input type="hidden" name="studentId" value={child.id} />
                      <Field label="What happened?">
                        <textarea
                          name="reason"
                          minLength={3}
                          maxLength={500}
                          required
                        />
                      </Field>
                      <label className="checkbox-row">
                        <input type="checkbox" name="startLostWorkflow" /> Ask
                        the school to start guarded lost-device mode now
                      </label>
                      <small>
                        A high-priority school alert is always created. School
                        and exam restrictions remain in control.
                      </small>
                      <SubmitButton>Send report</SubmitButton>
                    </form>
                  </ActionPanel>
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
                          <span>
                            Approved {formatDateTime(item.approvedAt)}
                          </span>
                        </div>
                        <StatusPill tone="good">
                          {humanize(item.type)}
                        </StatusPill>
                      </article>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title="No recent approved access"
                    body="Teacher-approved resources and temporary websites will appear here without exposing browsing history."
                  />
                )}
                <ActionPanel title="Request device support">
                  <form
                    action={createGuardianSupportRequestAction}
                    className="form-grid"
                  >
                    <input
                      type="hidden"
                      name="tenantId"
                      value={dashboard.tenantId}
                    />
                    <input type="hidden" name="studentId" value={child.id} />
                    <Field label="Issue type">
                      <select name="category" required>
                        <option value="DEVICE">Device</option>
                        <option value="CONNECTIVITY">Connectivity</option>
                        <option value="ACCESS">Access</option>
                        <option value="OTHER">Other</option>
                      </select>
                    </Field>
                    <Field label="Subject">
                      <input name="subject" maxLength={120} required />
                    </Field>
                    <Field label="What help is needed?">
                      <textarea name="description" maxLength={1000} required />
                    </Field>
                    <SubmitButton>Open support request</SubmitButton>
                  </form>
                </ActionPanel>
              </PageSection>
            ))}
          </>
        )}
      </div>
    </AppShell>
  );
}

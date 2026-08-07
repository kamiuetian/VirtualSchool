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
  updateGuardianLanguageAction,
  updateGuardianAfterSchoolAction,
} from "../../lib/actions";
import { formatDateTime, humanize } from "../../lib/format";
import { guardianText } from "../../lib/guardian-i18n";

export const dynamic = "force-dynamic";

export default async function GuardianPage() {
  const { dashboard, connectionIssue } = await getGuardianDashboard();
  const locale = dashboard?.locale ?? "en";
  const t = (text: string) => guardianText(locale, text);
  return (
    <AppShell connectionIssue={connectionIssue} tenant={null}>
      <div className="content-stack">
        <section className="hero-panel">
          <div>
            <span className="eyebrow">{t("Guardian view")}</span>
            <h2>
              {dashboard
                ? `${t("Welcome")}, ${dashboard.guardianName}.`
                : t("Your family learning view")}
            </h2>
            <p>
              {dashboard?.privacyMessage ??
                t(
                  "Linked-child information will appear after your school connects your account.",
                )}
            </p>
          </div>
        </section>
        {!dashboard ? (
          <EmptyState
            title={t("Guardian profile unavailable")}
            body={t(
              "Confirm that your sign-in email is linked to a student by your school.",
            )}
          />
        ) : dashboard.children.length === 0 ? (
          <EmptyState
            title={t("No linked children")}
            body={t(
              "Ask the school roster administrator to review your guardian link.",
            )}
          />
        ) : (
          <>
            <PageSection
              kicker={t("Family preferences")}
              title={t("Consent and notifications")}
            >
              <div className="two-column-grid">
                <ActionPanel title={t("Language")}>
                  <form
                    action={updateGuardianLanguageAction}
                    className="form-grid"
                  >
                    <input
                      type="hidden"
                      name="tenantId"
                      value={dashboard.tenantId}
                    />
                    <select name="language" defaultValue={locale}>
                      {dashboard.supportedLocales.map((item) => (
                        <option key={item.code} value={item.code}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                    <SubmitButton>{t("Save language")}</SubmitButton>
                  </form>
                </ActionPanel>
                <ActionPanel title={t("Required forms")}>
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
                          <StatusPill tone="good">{t("Accepted")}</StatusPill>
                        ) : (
                          <SubmitButton>
                            {t("Accept this version")}
                          </SubmitButton>
                        )}
                      </form>
                    ))
                  ) : (
                    <p>
                      {t("No guardian forms are currently awaiting review.")}
                    </p>
                  )}
                </ActionPanel>
                <ActionPanel title={t("Notification channels")}>
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
                      {t(
                        "Only contact methods registered with the school are available.",
                      )}
                    </small>
                    <SubmitButton>
                      {t("Save notification channels")}
                    </SubmitButton>
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
                    <span>{t("Device availability")}</span>
                    <strong>{t(humanize(child.device.availability))}</strong>
                    <small>
                      {child.device.lastSeenAt
                        ? `${t("Last seen")} ${formatDateTime(child.device.lastSeenAt)}`
                        : t("No check-in shared")}
                    </small>
                  </article>
                  <article className="stat-card">
                    <span>{t("Expected mode")}</span>
                    <strong>{t(humanize(child.expectedMode))}</strong>
                    <small>
                      {t("Based on school schedule and active class mode")}
                    </small>
                  </article>
                  <article className="stat-card">
                    <span>{t("School hours")}</span>
                    <strong>{child.schoolHours.length}</strong>
                    <small>{t("Scheduled blocks this week")}</small>
                  </article>
                </div>
                <div className="two-column-grid">
                  <ActionPanel title={t("After-school learning choices")}>
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
                        {t("Enable after-school choices")}
                      </label>
                      <Field label={t("Daily limit (minutes)")}>
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
                        <legend>{t("School-approved apps")}</legend>
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
                          ? t("Active now during after-school mode.")
                          : child.afterSchoolControl.inactiveReason
                            ? t(child.afterSchoolControl.inactiveReason)
                            : null}
                      </small>
                      <SubmitButton>{t("Save choices")}</SubmitButton>
                    </form>
                  </ActionPanel>
                  <ActionPanel title={t("Report a missing device")}>
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
                      <Field label={t("What happened?")}>
                        <textarea
                          name="reason"
                          minLength={3}
                          maxLength={500}
                          required
                        />
                      </Field>
                      <label className="checkbox-row">
                        <input type="checkbox" name="startLostWorkflow" />
                        {t(
                          "Ask the school to start guarded lost-device mode now",
                        )}
                      </label>
                      <small>
                        {t(
                          "A high-priority school alert is always created. School and exam restrictions remain in control.",
                        )}
                      </small>
                      <SubmitButton>{t("Send report")}</SubmitButton>
                    </form>
                  </ActionPanel>
                </div>
                <h3>{t("Recently approved learning access")}</h3>
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
                            {t("Approved")} {formatDateTime(item.approvedAt)}
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
                    title={t("No recent approved access")}
                    body={t(
                      "Teacher-approved resources and temporary websites will appear here without exposing browsing history.",
                    )}
                  />
                )}
                <ActionPanel title={t("Request device support")}>
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
                    <Field label={t("Issue type")}>
                      <select name="category" required>
                        <option value="DEVICE">{t("Device")}</option>
                        <option value="CONNECTIVITY">
                          {t("Connectivity")}
                        </option>
                        <option value="ACCESS">{t("Access")}</option>
                        <option value="OTHER">{t("Other")}</option>
                      </select>
                    </Field>
                    <Field label={t("Subject")}>
                      <input name="subject" maxLength={120} required />
                    </Field>
                    <Field label={t("What help is needed?")}>
                      <textarea name="description" maxLength={1000} required />
                    </Field>
                    <SubmitButton>{t("Open support request")}</SubmitButton>
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

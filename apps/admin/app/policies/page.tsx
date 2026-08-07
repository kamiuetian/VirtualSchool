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
import {
  assignPolicyAction,
  createStarterPoliciesAction,
  issueSupportUnlockAction,
  publishPolicyAction,
  rollbackPolicyAction,
  simulateUrlPolicyAction,
  updateAndroidPolicyControlsAction,
} from "../../lib/actions";
import { getAdminData } from "../../lib/api";
import { formatCount, formatDateTime, humanize } from "../../lib/format";

export const dynamic = "force-dynamic";

export default async function PoliciesPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | undefined>>;
}) {
  const simulation = await searchParams;
  const data = await getAdminData("/policies");
  const published = data.policies.filter(
    (policy) => policy.status === "PUBLISHED",
  );
  const supportPolicies = published.filter(
    (policy) => policy.rules.mode === "EMERGENCY_SUPPORT_OVERRIDE",
  );

  return (
    <AppShell
      connectionIssue={data.connectionIssue}
      tenant={data.selectedTenant}
    >
      <div className="content-stack">
        <PageSection kicker="Learning controls" title="Policies And Modes">
          <section className="stat-grid" aria-label="Policy summary">
            <StatCard
              label="Policies"
              value={formatCount(data.policies.length)}
            />
            <StatCard
              label="Published"
              tone="good"
              value={formatCount(published.length)}
            />
            <StatCard
              label="Assignments"
              value={formatCount(data.policyAssignments.length)}
            />
            <StatCard
              label="MDM publish failures"
              tone={
                data.policies.some(
                  (policy) => policy.mdmPublishStatus === "FAILED",
                )
                  ? "critical"
                  : "good"
              }
              value={formatCount(
                data.policies.filter(
                  (policy) => policy.mdmPublishStatus === "FAILED",
                ).length,
              )}
            />
          </section>
        </PageSection>

        {data.selectedTenant ? (
          <PageSection kicker="Policy actions" title="Publish And Assign">
            <div className="form-grid">
              <ActionPanel title="Starter templates">
                <form
                  action={createStarterPoliciesAction}
                  className="stacked-form"
                >
                  <input
                    name="tenantId"
                    type="hidden"
                    value={data.selectedTenant.id}
                  />
                  <p className="form-help">
                    Create the standard lockdown, supervised learning, homework,
                    exam, lost device, maintenance, and default school policies.
                  </p>
                  <SubmitButton>Create missing templates</SubmitButton>
                </form>
              </ActionPanel>

              {data.policies.length > 0 ? (
                <>
                  <ActionPanel title="Test URL policy">
                    <form
                      action={simulateUrlPolicyAction}
                      className="stacked-form"
                    >
                      <input
                        name="tenantId"
                        type="hidden"
                        value={data.selectedTenant.id}
                      />
                      <Field label="Policy">
                        <select name="policyId" required>
                          {data.policies.map((policy) => (
                            <option key={policy.id} value={policy.id}>
                              {policy.name}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="URL">
                        <input
                          name="url"
                          placeholder="https://learning.example.edu/lesson"
                          required
                          type="url"
                        />
                      </Field>
                      <SubmitButton>Simulate access</SubmitButton>
                      {simulation?.decision ? (
                        <p className="form-help" aria-live="polite">
                          <strong>{simulation.decision}</strong> (
                          {simulation.effectiveAccess}) — {simulation.reason}.
                          Winning rule:{" "}
                          {simulation.matchedRule || "default policy"}.
                        </p>
                      ) : null}
                    </form>
                  </ActionPanel>
                  <ActionPanel title="Publish policy">
                    <form action={publishPolicyAction} className="stacked-form">
                      <input
                        name="tenantId"
                        type="hidden"
                        value={data.selectedTenant.id}
                      />
                      <Field label="Policy">
                        <select name="policyId" required>
                          {data.policies.map((policy) => (
                            <option key={policy.id} value={policy.id}>
                              {policy.name}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Reason">
                        <input
                          name="reason"
                          placeholder="Ready for class rollout"
                        />
                      </Field>
                      <SubmitButton>Publish</SubmitButton>
                    </form>
                  </ActionPanel>

                  <ActionPanel title="Assign policy">
                    <form action={assignPolicyAction} className="stacked-form">
                      <input
                        name="tenantId"
                        type="hidden"
                        value={data.selectedTenant.id}
                      />
                      <Field label="Policy">
                        <select name="policyId" required>
                          {data.policies.map((policy) => (
                            <option key={policy.id} value={policy.id}>
                              {policy.name}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <div className="form-row">
                        <Field label="Scope">
                          <select name="scope" defaultValue="TENANT">
                            <option value="TENANT">Whole school</option>
                            <option value="GRADE">Grade</option>
                            <option value="CLASS">Class</option>
                            <option value="STUDENT">Student</option>
                            <option value="DEVICE">Device</option>
                          </select>
                        </Field>
                        <Field label="Target ID">
                          <input
                            name="scopeId"
                            placeholder="Omit for whole school"
                          />
                        </Field>
                      </div>
                      <Field label="Reason">
                        <input
                          name="reason"
                          placeholder="Baseline learning mode"
                        />
                      </Field>
                      <SubmitButton>Assign</SubmitButton>
                    </form>
                  </ActionPanel>
                </>
              ) : null}

              {data.policies.some((policy) => policy.status === "DRAFT") ? (
                <ActionPanel title="Android device controls">
                  <form
                    action={updateAndroidPolicyControlsAction}
                    className="stacked-form"
                  >
                    <input
                      name="tenantId"
                      type="hidden"
                      value={data.selectedTenant.id}
                    />
                    <Field label="Draft policy">
                      <select name="policyId" required>
                        {data.policies
                          .filter((policy) => policy.status === "DRAFT")
                          .map((policy) => (
                            <option key={policy.id} value={policy.id}>
                              {policy.name}
                            </option>
                          ))}
                      </select>
                    </Field>
                    <Field label="System update behavior">
                      <select name="updateType" defaultValue="WINDOWED">
                        <option value="WINDOWED">
                          Install in daily window
                        </option>
                        <option value="AUTOMATIC">Install automatically</option>
                        <option value="POSTPONE">Postpone up to 30 days</option>
                      </select>
                    </Field>
                    <div className="form-row">
                      <Field label="Window starts">
                        <input
                          defaultValue="01:00"
                          name="updateStartTime"
                          type="time"
                        />
                      </Field>
                      <Field label="Window ends">
                        <input
                          defaultValue="05:00"
                          name="updateEndTime"
                          type="time"
                        />
                      </Field>
                    </div>
                    <Field label="System navigation">
                      <select
                        name="systemNavigation"
                        defaultValue="NAVIGATION_DISABLED"
                      >
                        <option value="NAVIGATION_DISABLED">Disabled</option>
                        <option value="HOME_BUTTON_ONLY">
                          Home button only
                        </option>
                        <option value="NAVIGATION_ENABLED">Enabled</option>
                      </select>
                    </Field>
                    <Field label="Status bar">
                      <select
                        name="statusBar"
                        defaultValue="NOTIFICATIONS_AND_SYSTEM_INFO_DISABLED"
                      >
                        <option value="NOTIFICATIONS_AND_SYSTEM_INFO_DISABLED">
                          Hidden
                        </option>
                        <option value="SYSTEM_INFO_ONLY">
                          System info only
                        </option>
                        <option value="NOTIFICATIONS_AND_SYSTEM_INFO_ENABLED">
                          Notifications and system info
                        </option>
                      </select>
                    </Field>
                    <Field label="Power button">
                      <select
                        name="powerButtonActions"
                        defaultValue="POWER_BUTTON_BLOCKED"
                      >
                        <option value="POWER_BUTTON_BLOCKED">
                          Menu blocked
                        </option>
                        <option value="POWER_BUTTON_AVAILABLE">
                          Menu available
                        </option>
                      </select>
                    </Field>
                    <label>
                      <input
                        defaultChecked
                        name="blockFactoryReset"
                        type="checkbox"
                      />{" "}
                      Block factory reset from device settings
                    </label>
                    <p className="form-help">
                      Android Management supports a daily update window, a
                      30-day postponement, and kiosk navigation/status controls.
                      It cannot schedule different windows by weekday, set kiosk
                      wallpaper, or block hardware recovery resets.
                    </p>
                    <SubmitButton>Save Android controls</SubmitButton>
                  </form>
                </ActionPanel>
              ) : null}

              {published.length > 0 ? (
                <ActionPanel title="Rollback policy">
                  <form action={rollbackPolicyAction} className="stacked-form">
                    <input
                      name="tenantId"
                      type="hidden"
                      value={data.selectedTenant.id}
                    />
                    <Field label="Policy">
                      <select name="policyId" required>
                        {published.map((policy) => (
                          <option key={policy.id} value={policy.id}>
                            {policy.name} (current v{policy.version})
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Prior version">
                      <input min="1" name="version" required type="number" />
                    </Field>
                    <Field label="Reason">
                      <input
                        name="reason"
                        required
                        placeholder="Why rollback is required"
                      />
                    </Field>
                    <SubmitButton>Republish prior version</SubmitButton>
                  </form>
                </ActionPanel>
              ) : null}

              {supportPolicies.length > 0 ? (
                <ActionPanel title="Emergency support unlock">
                  <form
                    action={issueSupportUnlockAction}
                    className="stacked-form"
                  >
                    <input
                      name="tenantId"
                      type="hidden"
                      value={data.selectedTenant.id}
                    />
                    <Field label="Support policy">
                      <select name="policyId" required>
                        {supportPolicies.map((policy) => (
                          <option key={policy.id} value={policy.id}>
                            {policy.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Device ID">
                      <input name="deviceId" required />
                    </Field>
                    <Field label="Duration (minutes)">
                      <input
                        defaultValue="30"
                        max="480"
                        min="5"
                        name="durationMinutes"
                        required
                        type="number"
                      />
                    </Field>
                    <Field label="Reason">
                      <input
                        name="reason"
                        required
                        placeholder="Support case and purpose"
                      />
                    </Field>
                    <SubmitButton>Issue expiring unlock</SubmitButton>
                  </form>
                </ActionPanel>
              ) : null}
            </div>
          </PageSection>
        ) : null}

        <PageSection title="Policy Library">
          {data.policies.length > 0 ? (
            <div className="card-grid">
              {data.policies.map((policy) => (
                <article className="record-card" key={policy.id}>
                  <div>
                    <strong>{policy.name}</strong>
                    <span>{humanize(policy.rules.mode)}</span>
                  </div>
                  <StatusPill
                    tone={policy.status === "PUBLISHED" ? "good" : "neutral"}
                  >
                    {humanize(policy.status)}
                  </StatusPill>
                  <dl>
                    <div>
                      <dt>Version</dt>
                      <dd>v{policy.version}</dd>
                    </div>
                    <div>
                      <dt>Updated</dt>
                      <dd>{formatDateTime(policy.updatedAt)}</dd>
                    </div>
                    <div>
                      <dt>Web access</dt>
                      <dd>{humanize(policy.rules.defaultWebAccess)}</dd>
                    </div>
                    <div>
                      <dt>Android updates</dt>
                      <dd>
                        {humanize(
                          policy.rules.android?.systemUpdate?.type ??
                            "AUTOMATIC",
                        )}
                      </dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No policies created"
              body="Create starter templates for lockdown, supervised learning, homework, exam, lost device, and maintenance modes."
            />
          )}
        </PageSection>

        <PageSection title="Assignments">
          {data.policyAssignments.length > 0 ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Policy</th>
                    <th>Scope</th>
                    <th>Target</th>
                    <th>Version</th>
                    <th>Status</th>
                    <th>Expires</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {data.policyAssignments.map((assignment) => (
                    <tr key={assignment.id}>
                      <td>{assignment.policyName}</td>
                      <td>{humanize(assignment.scope)}</td>
                      <td>{assignment.scopeId ?? "Whole school"}</td>
                      <td>v{assignment.policyVersion}</td>
                      <td>
                        <StatusPill
                          tone={assignment.active ? "good" : "neutral"}
                        >
                          {assignment.active ? "Active" : "Inactive"}
                        </StatusPill>
                      </td>
                      <td>{formatDateTime(assignment.endsAt)}</td>
                      <td>{assignment.reason ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title="No active assignments"
              body="Assign published policies to the whole school, grades, classes, students, or individual devices."
            />
          )}
        </PageSection>

        <PageSection title="Blocked Domains — Last 30 Days">
          {data.blockedDomainAggregates.length > 0 ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Domain</th>
                    <th>Blocked events</th>
                    <th>Reasons</th>
                    <th>Last seen</th>
                  </tr>
                </thead>
                <tbody>
                  {data.blockedDomainAggregates.map((item) => (
                    <tr key={item.domain}>
                      <td>{item.domain}</td>
                      <td>{formatCount(item.count)}</td>
                      <td>{item.reasons.map(humanize).join(", ")}</td>
                      <td>{formatDateTime(item.lastOccurredAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title="No blocked-domain events"
              body="Privacy-limited domain totals appear after managed browsers report blocked navigation."
            />
          )}
        </PageSection>
      </div>
    </AppShell>
  );
}

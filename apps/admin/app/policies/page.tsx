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
  checkExamReadinessAction,
  launchAssessmentAction,
  unlockExamDeviceAction,
  updateWebFilterSettingsAction,
  updatePlatformOverridesAction,
  simulatePlatformPolicyAction,
} from "../../lib/actions";
import {
  getAdminData,
  getExamReadiness,
  getExamReport,
  getWebFilterSettings,
  getDeviceCapabilities,
} from "../../lib/api";
import { formatCount, formatDateTime, humanize } from "../../lib/format";

export const dynamic = "force-dynamic";

export default async function PoliciesPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | undefined>>;
}) {
  const simulation = await searchParams;
  const data = await getAdminData("/policies");
  const webFilter = data.selectedTenant
    ? await getWebFilterSettings(data.selectedTenant.id)
    : null;
  const capabilityData = data.selectedTenant
    ? await getDeviceCapabilities(data.selectedTenant.id)
    : { catalog: [], connectionIssue: false };
  const published = data.policies.filter(
    (policy) => policy.status === "PUBLISHED",
  );
  const supportPolicies = published.filter(
    (policy) => policy.rules.mode === "EMERGENCY_SUPPORT_OVERRIDE",
  );
  const examPolicyIds = new Set(
    published
      .filter((policy) => policy.rules.mode === "EXAM")
      .map((policy) => policy.id),
  );
  const examAssignments = data.policyAssignments.filter((assignment) =>
    examPolicyIds.has(assignment.policyId),
  );
  const readinessResult =
    simulation?.examAssignmentId && data.selectedTenant
      ? await getExamReadiness(
          data.selectedTenant.id,
          simulation.examAssignmentId,
        )
      : null;
  const readiness = readinessResult?.readiness ?? null;
  const reportResult =
    simulation?.examAssignmentId && data.selectedTenant
      ? await getExamReport(data.selectedTenant.id, simulation.examAssignmentId)
      : null;
  const report = reportResult?.report ?? null;

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
              <ActionPanel title="Global web safety">
                <form
                  action={updateWebFilterSettingsAction}
                  className="stacked-form"
                >
                  <input
                    name="tenantId"
                    type="hidden"
                    value={data.selectedTenant.id}
                  />
                  <Field label="Never-allowed URL rules">
                    <textarea
                      name="neverAllowedUrls"
                      defaultValue={webFilter?.neverAllowedUrls.join("\n")}
                      placeholder={
                        "https://unsafe.example/*\nhttps://blocked.example/"
                      }
                      rows={4}
                    />
                  </Field>
                  <Field label="Blocked categories">
                    <select
                      name="blockedCategories"
                      defaultValue={webFilter?.blockedCategories}
                      multiple
                      size={6}
                    >
                      <option value="ADULT_CONTENT">Adult content</option>
                      <option value="GAMBLING">Gambling</option>
                      <option value="MALWARE">Malware</option>
                      <option value="SOCIAL_MEDIA">Social media</option>
                      <option value="STREAMING_MEDIA">Streaming media</option>
                      <option value="VIOLENCE">Violence</option>
                    </select>
                  </Field>
                  <Field label="Educational video allowlist">
                    <textarea
                      name="educationalVideoAllowlist"
                      defaultValue={(webFilter?.educationalVideoAllowlist ?? [])
                        .map((entry) =>
                          [
                            entry.kind,
                            entry.value,
                            entry.scope,
                            entry.scopeId ?? "",
                          ].join(" | "),
                        )
                        .join("\n")}
                      placeholder={
                        "VIDEO | dQw4w9WgXcQ | TENANT |\nPLAYLIST | PL123 | GRADE | 8\nCHANNEL | UC123 | CLASS | class-id\nDOMAIN | media.school.edu | MODE | EXAM"
                      }
                      rows={6}
                    />
                  </Field>
                  <label>
                    <input
                      defaultChecked={webFilter?.safeSearch.google ?? true}
                      name="safeSearchGoogle"
                      type="checkbox"
                    />{" "}
                    Google SafeSearch
                  </label>
                  <label>
                    <input
                      defaultChecked={webFilter?.safeSearch.bing ?? true}
                      name="safeSearchBing"
                      type="checkbox"
                    />{" "}
                    Bing SafeSearch
                  </label>
                  <Field label="YouTube restricted mode">
                    <select
                      defaultValue={
                        webFilter?.safeSearch.youtubeRestrictedMode ?? "STRICT"
                      }
                      name="youtubeRestrictedMode"
                    >
                      <option value="STRICT">Strict</option>
                      <option value="MODERATE">Moderate</option>
                      <option value="OFF">Off</option>
                    </select>
                  </Field>
                  <p className="form-help">
                    Video entries use KIND | provider ID or domain | SCOPE |
                    scope ID. TENANT scope leaves the final value blank. A
                    video, playlist, or channel approval does not allow the rest
                    of YouTube. Never-allowed rules still win. These controls
                    are supplied to the managed browser and do not control
                    unmanaged browsers or guarantee external provider metadata.
                  </p>
                  <SubmitButton>Save global web safety</SubmitButton>
                </form>
              </ActionPanel>
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
                <>
                  <ActionPanel title="Cross-platform overrides">
                    <form
                      action={updatePlatformOverridesAction}
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
                      <Field label="Platform">
                        <select name="platform" required>
                          {capabilityData.catalog.map((entry) => (
                            <option key={entry.platform} value={entry.platform}>
                              {humanize(entry.platform)}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <label>
                        <input name="kiosk" type="checkbox" /> Enable kiosk
                      </label>
                      <label>
                        <input name="web-filter" type="checkbox" /> Enable web
                        filtering
                      </label>
                      <label>
                        <input name="app-deployment" type="checkbox" /> Enable
                        app deployment
                      </label>
                      <p className="form-help">
                        Saving makes all three values explicit for the selected
                        OS. Preview the target enrollment before publishing; an
                        override that differs from the business policy is
                        reported as a conflict.
                      </p>
                      <SubmitButton>Save OS overrides</SubmitButton>
                    </form>
                  </ActionPanel>
                  <ActionPanel title="Preview platform mapping">
                    <form
                      action={simulatePlatformPolicyAction}
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
                      <Field label="Platform">
                        <select name="platform" required>
                          {capabilityData.catalog.map((entry) => (
                            <option key={entry.platform} value={entry.platform}>
                              {humanize(entry.platform)}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Enrollment">
                        <select
                          name="enrollmentType"
                          defaultValue="FULLY_MANAGED"
                        >
                          <option value="FULLY_MANAGED">Fully managed</option>
                          <option value="SUPERVISED">Supervised</option>
                          <option value="USER_ENROLLED">User enrolled</option>
                          <option value="BYOD_SESSION">BYOD session</option>
                        </select>
                      </Field>
                      <Field label="Ownership">
                        <select
                          name="ownershipType"
                          defaultValue="SCHOOL_OWNED"
                        >
                          <option value="SCHOOL_OWNED">School owned</option>
                          <option value="CORPORATE">Corporate</option>
                          <option value="PERSONAL">Personal</option>
                        </select>
                      </Field>
                      <Field label="OS version">
                        <input
                          name="osVersion"
                          placeholder="Optional inventory version"
                        />
                      </Field>
                      <SubmitButton>Preview controls</SubmitButton>
                      {simulation?.platformName ? (
                        <p className="form-help" aria-live="polite">
                          <strong>{humanize(simulation.platformName)}</strong>:{" "}
                          {simulation.platformPublishable === "true"
                            ? "publishable"
                            : "blocked by unsupported enabled controls"}
                          . Conflicts: {simulation.platformConflicts || "none"}.
                          Unsupported:{" "}
                          {simulation.platformUnsupported || "none"}.
                        </p>
                      ) : null}
                    </form>
                  </ActionPanel>
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
                          <option value="AUTOMATIC">
                            Install automatically
                          </option>
                          <option value="POSTPONE">
                            Postpone up to 30 days
                          </option>
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
                        30-day postponement, and kiosk navigation/status
                        controls. It cannot schedule different windows by
                        weekday, set kiosk wallpaper, or block hardware recovery
                        resets.
                      </p>
                      <SubmitButton>Save Android controls</SubmitButton>
                    </form>
                  </ActionPanel>
                </>
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

        {data.selectedTenant && examAssignments.length > 0 ? (
          <PageSection
            kicker="Assessment operations"
            title="Exam Readiness And Secure Launch"
          >
            <div className="form-grid">
              <ActionPanel title="Run readiness check">
                <form
                  action={checkExamReadinessAction}
                  className="stacked-form"
                >
                  <Field label="Exam schedule">
                    <select
                      name="assignmentId"
                      defaultValue={simulation?.examAssignmentId}
                      required
                    >
                      {examAssignments.map((assignment) => (
                        <option key={assignment.id} value={assignment.id}>
                          {assignment.policyName} — {assignment.scope}{" "}
                          {assignment.scopeId}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <SubmitButton>Check targeted devices</SubmitButton>
                </form>
                {readiness ? (
                  <p className="form-help" aria-live="polite">
                    <strong>{readiness.ready} ready</strong>;{" "}
                    {readiness.blocked} blocked. Checks cover connectivity,
                    battery, policy, required apps, and managed browser support.
                  </p>
                ) : null}
              </ActionPanel>
              <ActionPanel title="Launch approved assessment">
                <form action={launchAssessmentAction} className="stacked-form">
                  <input
                    name="tenantId"
                    type="hidden"
                    value={data.selectedTenant.id}
                  />
                  <Field label="Exam schedule">
                    <select
                      name="assignmentId"
                      defaultValue={simulation?.examAssignmentId}
                      required
                    >
                      {examAssignments.map((assignment) => (
                        <option key={assignment.id} value={assignment.id}>
                          {assignment.policyName} — {assignment.scope}{" "}
                          {assignment.scopeId}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Resource type">
                    <select name="resourceType" required>
                      <option value="URL">Approved exam link</option>
                      <option value="APP">Approved exam app</option>
                    </select>
                  </Field>
                  <Field label="Approved URL or package ID">
                    <input name="resource" required />
                  </Field>
                  <Field label="Reason">
                    <input
                      name="reason"
                      placeholder="Start scheduled assessment"
                    />
                  </Field>
                  <SubmitButton>Launch on ready devices</SubmitButton>
                  {simulation?.launch === "queued" ? (
                    <p className="form-help" aria-live="polite">
                      Secure launch queued for ready devices.
                    </p>
                  ) : null}
                </form>
              </ActionPanel>
              <ActionPanel title="Emergency device unlock">
                <form action={unlockExamDeviceAction} className="stacked-form">
                  <input
                    name="tenantId"
                    type="hidden"
                    value={data.selectedTenant.id}
                  />
                  <Field label="Exam schedule">
                    <select
                      name="assignmentId"
                      defaultValue={simulation?.examAssignmentId}
                      required
                    >
                      {examAssignments
                        .filter((assignment) => assignment.active)
                        .map((assignment) => (
                          <option key={assignment.id} value={assignment.id}>
                            {assignment.policyName} — {assignment.scope}{" "}
                            {assignment.scopeId}
                          </option>
                        ))}
                    </select>
                  </Field>
                  <Field label="Device ID">
                    <input name="deviceId" required />
                  </Field>
                  <Field label="Minutes">
                    <input
                      name="durationMinutes"
                      type="number"
                      min="1"
                      max="15"
                      defaultValue="5"
                      required
                    />
                  </Field>
                  <Field label="Reason">
                    <input
                      name="reason"
                      minLength={3}
                      required
                      placeholder="Candidate support case"
                    />
                  </Field>
                  <SubmitButton>Queue audited unlock</SubmitButton>
                  {simulation?.unlock === "queued" ? (
                    <p className="form-help" aria-live="polite">
                      Bounded emergency unlock queued and audited.
                    </p>
                  ) : null}
                </form>
              </ActionPanel>
            </div>
            {readiness && readiness.devices.length > 0 ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Device</th>
                      <th>Status</th>
                      <th>Battery</th>
                      <th>Policy</th>
                      <th>Issues</th>
                    </tr>
                  </thead>
                  <tbody>
                    {readiness.devices.map((device) => (
                      <tr key={device.deviceId}>
                        <td>{device.serialNumber}</td>
                        <td>
                          <StatusPill tone={device.ready ? "good" : "critical"}>
                            {device.ready ? "Ready" : "Blocked"}
                          </StatusPill>
                        </td>
                        <td>
                          {device.batteryLevel === null
                            ? "Unknown"
                            : `${device.batteryLevel}%`}
                        </td>
                        <td>
                          {device.policyVersion === null
                            ? "Unknown"
                            : `v${device.policyVersion}`}
                        </td>
                        <td>
                          {device.issues.length
                            ? device.issues.map(humanize).join(", ")
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
            {report ? (
              <div className="card-grid" aria-label="Post-exam report">
                <article className="record-card">
                  <strong>Attendance</strong>
                  <p>
                    {report.attendance.participated} participated;{" "}
                    {report.attendance.absent} absent of{" "}
                    {report.attendance.targeted} targeted.
                  </p>
                </article>
                <article className="record-card">
                  <strong>Readiness</strong>
                  <p>
                    {report.readiness.ready} ready; {report.readiness.blocked}{" "}
                    blocked.
                  </p>
                </article>
                <article className="record-card">
                  <strong>Integrity and support</strong>
                  <p>
                    {report.integrityEvents.length} integrity events;{" "}
                    {report.failures.length} failures; {report.unlocks.length}{" "}
                    unlocks.
                  </p>
                </article>
              </div>
            ) : null}
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

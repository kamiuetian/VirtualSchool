import { AppShell } from "../../components/app-shell";
import { roleAllows } from "@virtual-school/shared";
import {
  EmptyState,
  PageSection,
  StatCard,
  StatusPill,
  ActionPanel,
  Field,
  SubmitButton,
} from "../../components/ui";
import {
  getAdminData,
  getAttendanceData,
  getLearningUsageAnalytics,
  getQuarterlyBusinessReviews,
} from "../../lib/api";
import {
  captureAttendanceAction,
  correctAttendanceAction,
  updateAttendanceSettingsAction,
  generateQuarterlyBusinessReviewAction,
} from "../../lib/actions";
import { formatCount, formatDateTime, humanize } from "../../lib/format";

export const dynamic = "force-dynamic";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams?: Promise<{
    classId?: string;
    date?: string;
    analyticsFrom?: string;
    analyticsTo?: string;
    analyticsClassId?: string;
    analyticsGrade?: string;
    deviceGroup?: string;
    category?: string;
  }>;
}) {
  const data = await getAdminData("/reports");
  const params = await searchParams;
  const attendanceDate = params?.date ?? new Date().toISOString().slice(0, 10);
  const attendanceClassId = params?.classId ?? data.classes[0]?.id;
  const attendance = data.selectedTenant
    ? await getAttendanceData(
        data.selectedTenant.id,
        attendanceClassId,
        attendanceDate,
      )
    : { settings: null, report: null, connectionIssue: false };
  const analyticsTo = params?.analyticsTo ?? new Date().toISOString().slice(0, 10);
  const analyticsDefaultFrom = new Date(`${analyticsTo}T00:00:00.000Z`);
  analyticsDefaultFrom.setUTCDate(analyticsDefaultFrom.getUTCDate() - 29);
  const analyticsFrom = params?.analyticsFrom ?? analyticsDefaultFrom.toISOString().slice(0, 10);
  const analytics = data.selectedTenant
    ? await getLearningUsageAnalytics(data.selectedTenant.id, {
        from: analyticsFrom,
        to: analyticsTo,
        classId: params?.analyticsClassId,
        grade: params?.analyticsGrade,
        deviceGroup: params?.deviceGroup,
        category: params?.category,
      })
    : { report: null, connectionIssue: false };
  const qbr = data.selectedTenant
    ? await getQuarterlyBusinessReviews(data.selectedTenant.id)
    : { packs: [], connectionIssue: false };
  const currentQuarter = `${new Date().getUTCFullYear()}-Q${Math.floor(new Date().getUTCMonth() / 3) + 1}`;
  const canManageAttendance = roleAllows(data.session.role, "class:manage");
  const deviceTotals = data.deviceInventory?.totals;
  const policyTotals = data.policyDeploymentReport?.totals;
  const appTotals = data.appDeploymentReport?.totals;

  return (
    <AppShell
      connectionIssue={data.connectionIssue}
      tenant={data.selectedTenant}
    >
      <div className="content-stack">
        <PageSection
          actions={
            data.selectedTenant ? (
              <a
                className="small-button primary"
                href="/reports/device-inventory.csv"
              >
                Download inventory CSV
              </a>
            ) : null
          }
          kicker="Exports"
          title="Operational Reports"
        >
          <section className="stat-grid" aria-label="Report summary">
            <StatCard
              label="Inventory devices"
              value={formatCount(deviceTotals?.devices ?? 0)}
            />
            <StatCard
              label="Policy failures"
              tone={
                (policyTotals?.failedDeployments ?? 0) > 0 ? "critical" : "good"
              }
              value={formatCount(policyTotals?.failedDeployments ?? 0)}
            />
            <StatCard
              label="App deployment failures"
              tone={
                (appTotals?.failedDeployments ?? 0) > 0 ? "critical" : "good"
              }
              value={formatCount(appTotals?.failedDeployments ?? 0)}
            />
            <StatCard
              label="Queued work"
              value={formatCount(
                (policyTotals?.queuedDeploymentCommands ?? 0) +
                  (appTotals?.queuedCommands ?? 0),
              )}
            />
          </section>
        </PageSection>

        <PageSection
          kicker="Customer success"
          title="Quarterly Business Review Packs"
        >
          {data.selectedTenant ? (
            <ActionPanel title="Generate an immutable review snapshot">
              <form action={generateQuarterlyBusinessReviewAction} className="inline-form">
                <input name="tenantId" type="hidden" value={data.selectedTenant.id} />
                <Field label="Quarter">
                  <input
                    defaultValue={currentQuarter}
                    name="quarter"
                    pattern="[0-9]{4}-Q[1-4]"
                    placeholder="2026-Q2"
                    required
                  />
                </Field>
                <SubmitButton>Generate QBR pack</SubmitButton>
              </form>
            </ActionPanel>
          ) : null}
          {qbr.packs.length ? (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Quarter</th><th>Period</th><th>Generated</th><th>Integrity</th></tr></thead>
                <tbody>{qbr.packs.map((pack) => (
                  <tr key={pack.id}>
                    <td>{pack.quarter}</td>
                    <td>{pack.periodStart.slice(0, 10)} to {pack.periodEnd.slice(0, 10)}</td>
                    <td>{formatDateTime(pack.generatedAt)}</td>
                    <td><code>{pack.checksum.slice(0, 12)}</code></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="No QBR packs yet" body="Generate a quarter to capture adoption, health, policy, support, mode usage, trends, and evidence-backed recommendations." />
          )}
        </PageSection>

        <PageSection
          kicker="Privacy-limited learning evidence"
          title="Learning Access And Device Usage"
        >
          <form className="inline-form wide" method="get">
            <Field label="From">
              <input defaultValue={analyticsFrom} name="analyticsFrom" type="date" />
            </Field>
            <Field label="To">
              <input defaultValue={analyticsTo} name="analyticsTo" type="date" />
            </Field>
            <Field label="Class">
              <select defaultValue={params?.analyticsClassId ?? ""} name="analyticsClassId">
                <option value="">All classes</option>
                {data.classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </Field>
            <Field label="Grade">
              <input defaultValue={params?.analyticsGrade ?? ""} name="analyticsGrade" placeholder="All grades" />
            </Field>
            <Field label="Device group tag">
              <input defaultValue={params?.deviceGroup ?? ""} name="deviceGroup" placeholder="All groups" />
            </Field>
            <Field label="Resource category">
              <input defaultValue={params?.category ?? ""} name="category" placeholder="All categories" />
            </Field>
            <SubmitButton>Apply analytics filters</SubmitButton>
          </form>
          {analytics.report ? (
            <>
              <section className="stat-grid" aria-label="Learning usage totals">
                <StatCard label="Class sessions" value={formatCount(analytics.report.totals.sessions)} />
                <StatCard label="Participation records" value={formatCount(analytics.report.totals.participants)} />
                <StatCard label="Missed sessions" tone={analytics.report.totals.missedSessions ? "warning" : "good"} value={formatCount(analytics.report.totals.missedSessions)} />
                <StatCard label="Approved launches" value={formatCount(analytics.report.totals.approvedResourceLaunches)} />
                <StatCard label="Offline devices" tone={analytics.report.totals.offlineDevices ? "warning" : "good"} value={formatCount(analytics.report.totals.offlineDevices)} />
              </section>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Class</th><th>Sessions</th><th>Participation</th><th>Missed</th><th>Launches</th><th>Offline</th></tr></thead>
                  <tbody>{analytics.report.byClass.map((row) => (
                    <tr key={row.key}><td>{row.label}</td><td>{row.sessions}</td><td>{row.participants}</td><td>{row.missedSessions}</td><td>{row.approvedResourceLaunches}</td><td>{row.offlineDevices}</td></tr>
                  ))}</tbody>
                </table>
              </div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Date</th><th>Sessions</th><th>Participation</th><th>Missed</th><th>Approved launches</th></tr></thead>
                  <tbody>{analytics.report.trend.map((row) => (
                    <tr key={row.date}><td>{row.date}</td><td>{row.sessions}</td><td>{row.participants}</td><td>{row.missedSessions}</td><td>{row.approvedResourceLaunches}</td></tr>
                  ))}</tbody>
                </table>
              </div>
              <p className="muted">Breakdowns are also available by grade, device group tag, and approved resource category through the tenant-scoped API. Counts use attendance, class-session actions, and current managed-device state; browsing history is not collected.</p>
            </>
          ) : (
            <EmptyState title="Learning analytics unavailable" body="Analytics appear after class sessions, attendance capture, or managed-device activity is recorded." />
          )}
        </PageSection>

        <PageSection title="Device Inventory Export">
          {data.deviceInventory ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Serial</th>
                    <th>Model</th>
                    <th>Status</th>
                    <th>Compliance</th>
                    <th>Policy</th>
                    <th>Last check-in</th>
                  </tr>
                </thead>
                <tbody>
                  {data.deviceInventory.devices.slice(0, 12).map((device) => (
                    <tr key={device.id}>
                      <td>{device.serialNumber}</td>
                      <td>
                        {device.model ??
                          device.manufacturer ??
                          "Android tablet"}
                      </td>
                      <td>
                        <StatusPill
                          tone={device.status === "ONLINE" ? "good" : "neutral"}
                        >
                          {humanize(device.status)}
                        </StatusPill>
                      </td>
                      <td>{humanize(device.compliance)}</td>
                      <td>
                        {device.policyVersion
                          ? `v${device.policyVersion}`
                          : "Unassigned"}
                      </td>
                      <td>{formatDateTime(device.lastCheckInAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title="Inventory report unavailable"
              body="Device inventory exports become available after the API report service is reachable."
            />
          )}
        </PageSection>

        <PageSection
          kicker="Configured evidence"
          title="Attendance Capture And Corrections"
        >
          {data.selectedTenant && attendance.settings ? (
            <>
              {canManageAttendance ? (
                <ActionPanel title="Attendance signal policy">
                  <form
                    action={updateAttendanceSettingsAction}
                    className="inline-form wide"
                  >
                    <input
                      name="tenantId"
                      type="hidden"
                      value={data.selectedTenant.id}
                    />
                    {(["session", "device", "lms", "teacher"] as const).map(
                      (signal) => (
                        <label className="check-row" key={signal}>
                          <input
                            defaultChecked={
                              attendance.settings?.[`${signal}SignalEnabled`]
                            }
                            name={`${signal}SignalEnabled`}
                            type="checkbox"
                          />{" "}
                          {humanize(signal)} signal
                        </label>
                      ),
                    )}
                    <Field label="Signals required">
                      <input
                        defaultValue={attendance.settings.presentThreshold}
                        max="4"
                        min="1"
                        name="presentThreshold"
                        type="number"
                      />
                    </Field>
                    <SubmitButton>Save configuration</SubmitButton>
                  </form>
                </ActionPanel>
              ) : null}
              <ActionPanel title="Daily class register">
                <form className="inline-form wide" method="get">
                  <Field label="Class">
                    <select defaultValue={attendanceClassId} name="classId">
                      {data.classes.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Date">
                    <input
                      defaultValue={attendanceDate}
                      name="date"
                      type="date"
                    />
                  </Field>
                  <SubmitButton>View register</SubmitButton>
                </form>
                {canManageAttendance && attendanceClassId ? (
                  <form
                    action={captureAttendanceAction}
                    className="button-form"
                  >
                    <input
                      name="tenantId"
                      type="hidden"
                      value={data.selectedTenant.id}
                    />
                    <input
                      name="classId"
                      type="hidden"
                      value={attendanceClassId}
                    />
                    <input
                      name="attendanceDate"
                      type="hidden"
                      value={attendanceDate}
                    />
                    <button className="small-button primary" type="submit">
                      Capture configured signals
                    </button>
                  </form>
                ) : null}
              </ActionPanel>
              {attendance.report && attendance.report.records.length ? (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Student</th>
                        <th>Status</th>
                        <th>Derived</th>
                        <th>Evidence</th>
                        <th>Correction</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attendance.report.records.map((record) => (
                        <tr key={record.id}>
                          <td>{record.studentName}</td>
                          <td>
                            <StatusPill
                              tone={
                                record.status === "PRESENT" ? "good" : "neutral"
                              }
                            >
                              {humanize(record.status)}
                            </StatusPill>
                          </td>
                          <td>{humanize(record.derivedStatus)}</td>
                          <td>
                            {Object.entries(record.signals)
                              .filter(([, enabled]) => enabled)
                              .map(([name]) => humanize(name))
                              .join(", ") || "None"}
                          </td>
                          <td>
                            {canManageAttendance ? (
                              <form
                                action={correctAttendanceAction}
                                className="inline-form"
                              >
                                <input
                                  name="tenantId"
                                  type="hidden"
                                  value={data.selectedTenant!.id}
                                />
                                <input
                                  name="recordId"
                                  type="hidden"
                                  value={record.id}
                                />
                                <select
                                  name="status"
                                  defaultValue={record.status}
                                >
                                  <option>PRESENT</option>
                                  <option>ABSENT</option>
                                  <option>LATE</option>
                                  <option>EXCUSED</option>
                                </select>
                                <input
                                  aria-label="Correction reason"
                                  name="reason"
                                  placeholder="Reason"
                                  required
                                />
                                <button className="small-button" type="submit">
                                  Correct
                                </button>
                              </form>
                            ) : (
                              (record.correctionReason ?? "—")
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState
                  title="No attendance captured"
                  body="Choose a class and date, then capture the configured attendance signals."
                />
              )}
            </>
          ) : (
            <EmptyState
              title="Attendance unavailable"
              body="Attendance configuration becomes available when a tenant and roster are connected."
            />
          )}
        </PageSection>

        <PageSection title="Policy Deployment Report">
          {data.policyDeploymentReport ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Policy</th>
                    <th>Status</th>
                    <th>Assignments</th>
                    <th>Queued</th>
                    <th>Failed</th>
                    <th>Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {data.policyDeploymentReport.policies.map((policy) => (
                    <tr key={policy.policyId}>
                      <td>{policy.name}</td>
                      <td>{humanize(policy.status)}</td>
                      <td>{formatCount(policy.activeAssignmentCount)}</td>
                      <td>{formatCount(policy.queuedDeploymentCount)}</td>
                      <td>{formatCount(policy.failedDeploymentCount)}</td>
                      <td>{formatDateTime(policy.updatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title="Policy report unavailable"
              body="Policy deployment totals appear after policies and assignments are created."
            />
          )}
        </PageSection>

        <PageSection title="App Deployment Report">
          {data.appDeploymentReport ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>App</th>
                    <th>Package</th>
                    <th>Approval</th>
                    <th>Policies</th>
                    <th>Queued</th>
                    <th>Failed</th>
                  </tr>
                </thead>
                <tbody>
                  {data.appDeploymentReport.apps.map((app) => (
                    <tr key={app.appId}>
                      <td>{app.name}</td>
                      <td>{app.packageId}</td>
                      <td>{humanize(app.approvalStatus)}</td>
                      <td>{formatCount(app.assignedPolicyCount)}</td>
                      <td>{formatCount(app.queuedCommandCount)}</td>
                      <td>{formatCount(app.failedDeploymentCount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title="App report unavailable"
              body="Approved app deployment totals appear after app catalog and policy assignment activity."
            />
          )}
        </PageSection>
      </div>
    </AppShell>
  );
}

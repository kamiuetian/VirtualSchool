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
import { getAdminData, getAttendanceData } from "../../lib/api";
import {
  captureAttendanceAction,
  correctAttendanceAction,
  updateAttendanceSettingsAction,
} from "../../lib/actions";
import { formatCount, formatDateTime, humanize } from "../../lib/format";

export const dynamic = "force-dynamic";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams?: Promise<{ classId?: string; date?: string }>;
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

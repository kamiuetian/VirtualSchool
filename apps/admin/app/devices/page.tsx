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
  assignDeviceAction,
  bulkAssignDevicesAction,
  changeDeviceLifecycleAction,
  queueDeviceCommandAction,
  queueWipeDeviceAction,
} from "../../lib/actions";
import { getAdminData, getDeviceCapabilities, getDeviceOperationsData } from "../../lib/api";
import { roleCan } from "../../lib/auth/portal-access";
import { formatCount, formatDateTime, humanize } from "../../lib/format";

export const dynamic = "force-dynamic";

export default async function DevicesPage({
  searchParams,
}: {
  searchParams?: Promise<{ deviceId?: string; platform?: string; provider?: string; compliance?: string; osLifecycle?: string }>;
}) {
  const params = await searchParams;
  const data = await getAdminData("/devices");
  const selectedTenant = data.selectedTenant;
  const capabilityData = selectedTenant
    ? await getDeviceCapabilities(selectedTenant.id)
    : { catalog: [], connectionIssue: false };
  const filteredDevices = data.devices.filter((device) =>
    (!params?.platform || device.platform === params.platform) &&
    (!params?.provider || device.provider === params.provider) &&
    (!params?.compliance || device.compliance === params.compliance) &&
    (!params?.osLifecycle || device.complianceAssessment?.osLifecycle === params.osLifecycle),
  );
  const canAssignDevices = roleCan(data.session.role, "device:enroll");
  const canQueueCommands = roleCan(data.session.role, "device:command");
  const canWipeDevices = roleCan(data.session.role, "device:wipe");
  const selectedDevice =
    data.devices.find((device) => device.id === params?.deviceId) ??
    data.devices[0] ??
    null;
  const operations =
    selectedTenant && selectedDevice
      ? await getDeviceOperationsData(selectedTenant.id, selectedDevice.id)
      : {
          commands: [],
          connectionIssue: false,
          diagnostics: [],
          history: { assignments: [], lifecycle: [] },
        };
  const nonCompliant = data.devices.filter(
    (device) =>
      device.compliance !== "COMPLIANT" && device.compliance !== "UNKNOWN",
  );
  const offline = data.devices.filter((device) => device.status === "OFFLINE");
  const quarantined = data.devices.filter(
    (device) => !device.studentId && !device.classId,
  );

  return (
    <AppShell
      connectionIssue={data.connectionIssue || operations.connectionIssue || capabilityData.connectionIssue}
      tenant={selectedTenant}
    >
      <div className="content-stack">
        <PageSection kicker="Fleet" title="Device Inventory">
          <section className="stat-grid" aria-label="Device summary">
            <StatCard
              label="Total tablets"
              value={formatCount(data.devices.length)}
            />
            <StatCard
              label="Offline"
              tone={offline.length > 0 ? "warning" : "good"}
              value={formatCount(offline.length)}
            />
            <StatCard
              label="Needs assignment"
              tone={quarantined.length > 0 ? "warning" : "neutral"}
              value={formatCount(quarantined.length)}
            />
            <StatCard
              label="Compliance issues"
              tone={nonCompliant.length > 0 ? "critical" : "good"}
              value={formatCount(nonCompliant.length)}
            />
          </section>
        </PageSection>

        <PageSection kicker="Multi-OS" title="Capability Catalog">
          <form className="stacked-form" method="get">
            <div className="form-row">
              <Field label="Platform"><select defaultValue={params?.platform ?? ""} name="platform"><option value="">All platforms</option>{capabilityData.catalog.map((entry) => <option key={entry.platform} value={entry.platform}>{humanize(entry.platform)}</option>)}</select></Field>
              <Field label="Provider"><select defaultValue={params?.provider ?? ""} name="provider"><option value="">All providers</option>{[...new Set(capabilityData.catalog.map((entry) => entry.provider))].map((provider) => <option key={provider} value={provider}>{provider}</option>)}</select></Field>
              <Field label="Compliance"><select defaultValue={params?.compliance ?? ""} name="compliance"><option value="">All states</option><option value="COMPLIANT">Compliant</option><option value="NON_COMPLIANT">Non-compliant</option><option value="UNKNOWN">Unknown</option></select></Field>
              <Field label="OS lifecycle"><select defaultValue={params?.osLifecycle ?? ""} name="osLifecycle"><option value="">All lifecycle states</option><option value="SUPPORTED">Supported</option><option value="UPDATE_RECOMMENDED">Update recommended</option><option value="UNSUPPORTED">Unsupported</option><option value="UNKNOWN">Unknown</option></select></Field>
            </div>
            <SubmitButton>Apply filters</SubmitButton>
          </form>
          <div className="record-grid">
            {capabilityData.catalog.map((entry) => (
              <article className="record-card" key={entry.platform}>
                <strong>{humanize(entry.platform)}</strong><span className="cell-note">{entry.provider}</span>
                <ul>{entry.capabilities.map((capability) => <li key={capability.key}>{capability.label}: <strong>{humanize(capability.support)}</strong>{capability.note ? <span className="cell-note">{capability.note}</span> : null}</li>)}</ul>
              </article>
            ))}
          </div>
        </PageSection>

        {selectedTenant && canAssignDevices && data.devices.length > 0 ? (
          <PageSection kicker="Assignment" title="Assign Tablet">
            <div className="form-grid two">
              <ActionPanel title="Student, class, or campus assignment">
                <form action={assignDeviceAction} className="stacked-form">
                  <input
                    name="tenantId"
                    type="hidden"
                    value={selectedTenant.id}
                  />
                  <Field label="Device">
                    <select name="deviceId" required>
                      {data.devices.map((device) => (
                        <option key={device.id} value={device.id}>
                          {device.serialNumber}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <div className="form-row">
                    <Field label="Student ID">
                      <input name="studentId" placeholder="Optional" />
                    </Field>
                    <Field label="Class ID">
                      <input name="classId" placeholder="Optional" />
                    </Field>
                  </div>
                  <Field label="Branch ID">
                    <input name="branchId" placeholder="Optional" />
                  </Field>
                  <Field label="Tags">
                    <input name="tags" placeholder="pilot, grade-4" />
                  </Field>
                  <Field label="Reason">
                    <input
                      name="reason"
                      placeholder="Assigned during rollout"
                      required
                    />
                  </Field>
                  <SubmitButton>Save assignment</SubmitButton>
                </form>
              </ActionPanel>

              <ActionPanel title="Bulk device assignment">
                <form action={bulkAssignDevicesAction} className="stacked-form">
                  <input
                    name="tenantId"
                    type="hidden"
                    value={selectedTenant.id}
                  />
                  <Field label="CSV file">
                    <input name="csvFile" accept=".csv,text/csv" type="file" />
                  </Field>
                  <Field label="CSV rows">
                    <textarea
                      name="csv"
                      placeholder="deviceId,studentId,classId,branchId,tags,reason"
                    />
                  </Field>
                  <p className="form-help">
                    Device IDs are the portal IDs from the managed tablet table,
                    not serial numbers.
                  </p>
                  <a
                    className="small-button"
                    href="/devices/assignment-sample.csv"
                  >
                    Download device assignment sample CSV
                  </a>
                  <SubmitButton>Import assignments</SubmitButton>
                </form>
              </ActionPanel>
            </div>
          </PageSection>
        ) : null}

        {selectedTenant && selectedDevice ? (
          <PageSection kicker="Remote operations" title="Command Center">
            <div className="form-grid">
              {canQueueCommands ? (
                <ActionPanel title="Queue device command">
                  <form
                    action={queueDeviceCommandAction}
                    className="stacked-form"
                  >
                    <input
                      name="tenantId"
                      type="hidden"
                      value={selectedTenant.id}
                    />
                    <input
                      name="deviceId"
                      type="hidden"
                      value={selectedDevice.id}
                    />
                    <Field label="Selected tablet">
                      <select defaultValue={selectedDevice.id} disabled>
                        {data.devices.map((device) => (
                          <option key={device.id} value={device.id}>
                            {device.serialNumber}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Command">
                      <select name="type" defaultValue="REQUEST_CHECK_IN">
                        <option value="REQUEST_CHECK_IN">
                          Request check-in
                        </option>
                        <option value="POLICY_REFRESH">Refresh policy</option>
                        <option value="LOCK">Lock</option>
                        <option value="UNLOCK">Unlock</option>
                        <option value="SEND_MESSAGE">Send message</option>
                        <option value="RETIRE">Retire device</option>
                      </select>
                    </Field>
                    <Field label="Message">
                      <input
                        name="message"
                        placeholder="Shown only for message commands"
                      />
                    </Field>
                    <div className="form-row">
                      <Field label="TTL minutes">
                        <input
                          defaultValue="60"
                          min="1"
                          name="ttlMinutes"
                          type="number"
                        />
                      </Field>
                      <Field label="Attempts">
                        <input
                          defaultValue="3"
                          min="1"
                          name="maxAttempts"
                          type="number"
                        />
                      </Field>
                    </div>
                    <label className="check-field">
                      <input name="confirmed" type="checkbox" />
                      <span>Confirm high-impact operation</span>
                    </label>
                    <Field label="Reason">
                      <input
                        name="reason"
                        placeholder="Support or classroom operation"
                      />
                    </Field>
                    <SubmitButton>Queue command</SubmitButton>
                  </form>
                </ActionPanel>
              ) : null}

              {canWipeDevices ? (
                <ActionPanel title="Confirmed wipe">
                  <form action={queueWipeDeviceAction} className="stacked-form">
                    <input
                      name="tenantId"
                      type="hidden"
                      value={selectedTenant.id}
                    />
                    <input
                      name="deviceId"
                      type="hidden"
                      value={selectedDevice.id}
                    />
                    <p className="form-help">
                      Destructive reset requires the exact serial number and a
                      reason. Use only for approved lost-device or redeployment
                      cases.
                    </p>
                    <Field label="Serial confirmation">
                      <input
                        name="confirmationSerialNumber"
                        placeholder={selectedDevice.serialNumber}
                        required
                      />
                    </Field>
                    <Field label="Reason">
                      <input
                        name="reason"
                        placeholder="Approved wipe request"
                        required
                      />
                    </Field>
                    <label className="check-field">
                      <input
                        name="preserveFactoryResetProtection"
                        type="checkbox"
                      />
                      <span>Preserve factory reset protection</span>
                    </label>
                    <button className="submit-button danger" type="submit">
                      Queue wipe
                    </button>
                  </form>
                </ActionPanel>
              ) : null}

              <ActionPanel title="Selected tablet">
                <div className="profile-grid single">
                  <div>
                    <span>Serial</span>
                    <strong>{selectedDevice.serialNumber}</strong>
                  </div>
                  <div>
                    <span>Status</span>
                    <strong>{humanize(selectedDevice.status)}</strong>
                  </div>
                  <div>
                    <span>Compliance</span>
                    <strong>{humanize(selectedDevice.compliance)}</strong>
                  </div>
                  <div>
                    <span>Unified score</span>
                    <strong>{selectedDevice.complianceAssessment?.score ?? "—"}/100 · {humanize(selectedDevice.complianceAssessment?.grade ?? "UNKNOWN")}</strong>
                    <span className="cell-note">{selectedDevice.complianceAssessment?.reasons.join(" ")}</span>
                  </div>
                  <div>
                    <span>OS lifecycle</span>
                    <strong>{humanize(selectedDevice.complianceAssessment?.osLifecycle ?? "UNKNOWN")}</strong>
                    <span className="cell-note">{selectedDevice.complianceAssessment?.updateRecommendation}</span>
                    {selectedDevice.complianceAssessment?.restrictions.map((restriction) => <span className="cell-note" key={restriction}>{restriction}</span>)}
                  </div>
                </div>
              </ActionPanel>
              {canAssignDevices ? (
                <ActionPanel title="Device lifecycle">
                  <form
                    action={changeDeviceLifecycleAction}
                    className="stacked-form"
                  >
                    <input
                      name="tenantId"
                      type="hidden"
                      value={selectedTenant.id}
                    />
                    <input
                      name="deviceId"
                      type="hidden"
                      value={selectedDevice.id}
                    />
                    <Field label="Operation">
                      <select name="operation" defaultValue="unenroll">
                        <option value="unenroll">
                          Unenroll for reprovisioning
                        </option>
                        <option value="retire">Permanently retire</option>
                      </select>
                    </Field>
                    <Field label="Reason">
                      <input
                        name="reason"
                        required
                        placeholder="Approved lifecycle reason"
                      />
                    </Field>
                    <SubmitButton>Apply lifecycle change</SubmitButton>
                  </form>
                </ActionPanel>
              ) : null}
            </div>
          </PageSection>
        ) : null}

        <PageSection title="Unified Device Inventory">
          {filteredDevices.length > 0 ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Serial</th>
                    <th>Model</th>
                    <th>Platform</th>
                    <th>Status</th>
                    <th>Compliance</th>
                    <th>Policy</th>
                    <th>Assignment</th>
                    <th>Last check-in</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDevices.map((device) => (
                    <tr key={device.id}>
                      <td>
                        <a
                          className="table-link"
                          href={`/devices?deviceId=${device.id}`}
                        >
                          {device.serialNumber}
                        </a>
                        <span className="cell-note">ID: {device.id}</span>
                      </td>
                      <td>{humanize(device.platform ?? "ANDROID")} {device.osVersion ?? device.androidVersion}<span className="cell-note">{device.provider ?? device.mdmConnector} · {humanize(device.enrollmentType ?? "UNKNOWN")} · {humanize(device.ownershipType ?? "SCHOOL_OWNED")}</span>{device.unsupportedControls?.length ? <span className="cell-note">Unsupported: {device.unsupportedControls.map(humanize).join(", ")}</span> : null}</td>
                      <td>
                        {device.model ??
                          device.manufacturer ??
                          "Android tablet"}
                      </td>
                      <td>
                        <StatusPill tone={statusTone(device.status)}>
                          {humanize(device.status)}
                        </StatusPill>
                      </td>
                      <td>{device.complianceAssessment?.score ?? "—"}/100 · {humanize(device.complianceAssessment?.grade ?? device.compliance)}<span className="cell-note">OS: {humanize(device.complianceAssessment?.osLifecycle ?? "UNKNOWN")}</span></td>
                      <td>
                        {device.policyVersion
                          ? `v${device.policyVersion}`
                          : "Unassigned"}
                      </td>
                      <td>
                        {device.studentId ?? device.classId ?? "Quarantine"}
                      </td>
                      <td>{formatDateTime(device.lastCheckInAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title={data.devices.length ? "No devices match these filters" : "No managed devices enrolled"}
              body={data.devices.length ? "Change or clear the inventory filters." : "Enroll or connect a provider-managed device and it will appear here."}
            />
          )}
        </PageSection>

        <PageSection title="Command History">
          {operations.commands.length > 0 ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Command</th>
                    <th>Status</th>
                    <th>Attempts</th>
                    <th>Reason</th>
                    <th>Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {operations.commands.map((command) => (
                    <tr key={command.id}>
                      <td>{humanize(command.type)}</td>
                      <td>
                        <StatusPill tone={commandStatusTone(command.status)}>
                          {humanize(command.status)}
                        </StatusPill>
                      </td>
                      <td>
                        {command.attempts} of {command.maxAttempts}
                      </td>
                      <td>
                        {command.reason ??
                          command.failureReason ??
                          "Not recorded"}
                      </td>
                      <td>{formatDateTime(command.updatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title="No command history"
              body="Remote lock, unlock, policy refresh, message, check-in, and wipe commands will appear here."
            />
          )}
        </PageSection>

        <PageSection title="Assignment and Lifecycle History">
          {operations.history.assignments.length +
            operations.history.lifecycle.length >
          0 ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Assignment / event</th>
                    <th>Reason</th>
                    <th>Started</th>
                    <th>Ended</th>
                  </tr>
                </thead>
                <tbody>
                  {operations.history.lifecycle.map((event) => (
                    <tr key={event.id}>
                      <td>Lifecycle</td>
                      <td>{humanize(event.type)}</td>
                      <td>{event.reason}</td>
                      <td>{formatDateTime(event.createdAt)}</td>
                      <td>—</td>
                    </tr>
                  ))}
                  {operations.history.assignments.map((assignment) => (
                    <tr key={assignment.id}>
                      <td>Assignment</td>
                      <td>
                        {assignment.studentId ??
                          assignment.classId ??
                          assignment.branchId ??
                          "Unassigned"}
                      </td>
                      <td>{assignment.reason}</td>
                      <td>{formatDateTime(assignment.startedAt)}</td>
                      <td>{formatDateTime(assignment.endedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title="No lifecycle history"
              body="Assignments, reassignments, retirement, and unenrollment events will appear here."
            />
          )}
        </PageSection>

        <PageSection title="Recent Diagnostics">
          {operations.diagnostics.length > 0 ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Reported</th>
                    <th>Battery</th>
                    <th>Storage</th>
                    <th>Network</th>
                    <th>Health</th>
                    <th>Compliance</th>
                  </tr>
                </thead>
                <tbody>
                  {operations.diagnostics.map((diagnostic) => (
                    <tr key={diagnostic.id}>
                      <td>{formatDateTime(diagnostic.reportedAt)}</td>
                      <td>{diagnostic.batteryLevel ?? "Unknown"}</td>
                      <td>
                        {diagnostic.storageFreeMb
                          ? `${formatCount(diagnostic.storageFreeMb)} MB`
                          : "Unknown"}
                      </td>
                      <td>{diagnostic.networkStatus ?? "Unknown"}</td>
                      <td>
                        {diagnostic.health
                          ? humanize(diagnostic.health)
                          : "Unknown"}
                      </td>
                      <td>
                        {diagnostic.compliance
                          ? humanize(diagnostic.compliance)
                          : "Unknown"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title="No diagnostics received"
              body="Privacy-limited battery, storage, network, health, and compliance telemetry appears after launcher or MDM check-in."
            />
          )}
        </PageSection>
      </div>
    </AppShell>
  );
}

function statusTone(
  status: string,
): "neutral" | "good" | "warning" | "critical" {
  if (status === "ONLINE") return "good";
  if (
    status === "LOST" ||
    status === "NON_COMPLIANT" ||
    status === "ENROLLMENT_FAILED"
  ) {
    return "critical";
  }
  if (status === "OFFLINE" || status === "LOCKED") return "warning";
  return "neutral";
}

function commandStatusTone(
  status: string,
): "neutral" | "good" | "warning" | "critical" {
  if (status === "EXECUTED") return "good";
  if (status === "FAILED" || status === "EXPIRED") return "critical";
  if (status === "QUEUED" || status === "DELIVERED") return "warning";
  return "neutral";
}

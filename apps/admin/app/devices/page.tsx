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
  queueDeviceCommandAction,
  queueWipeDeviceAction,
} from "../../lib/actions";
import { getAdminData, getDeviceOperationsData } from "../../lib/api";
import { formatCount, formatDateTime, humanize } from "../../lib/format";

export const dynamic = "force-dynamic";

export default async function DevicesPage({
  searchParams,
}: {
  searchParams?: Promise<{ deviceId?: string }>;
}) {
  const params = await searchParams;
  const data = await getAdminData();
  const selectedTenant = data.selectedTenant;
  const selectedDevice =
    data.devices.find((device) => device.id === params?.deviceId) ??
    data.devices[0] ??
    null;
  const operations =
    selectedTenant && selectedDevice
      ? await getDeviceOperationsData(selectedTenant.id, selectedDevice.id)
      : { commands: [], connectionIssue: false, diagnostics: [] };
  const nonCompliant = data.devices.filter(
    (device) => device.compliance !== "COMPLIANT" && device.compliance !== "UNKNOWN",
  );
  const offline = data.devices.filter((device) => device.status === "OFFLINE");
  const quarantined = data.devices.filter((device) => !device.studentId && !device.classId);

  return (
    <AppShell
      connectionIssue={data.connectionIssue || operations.connectionIssue}
      tenant={selectedTenant}
    >
      <div className="content-stack">
        <PageSection kicker="Fleet" title="Device Inventory">
          <section className="stat-grid" aria-label="Device summary">
            <StatCard label="Total tablets" value={formatCount(data.devices.length)} />
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

        {selectedTenant && data.devices.length > 0 ? (
          <PageSection kicker="Assignment" title="Assign Tablet">
            <ActionPanel title="Student, class, or campus assignment">
              <form action={assignDeviceAction} className="inline-form">
                <input name="tenantId" type="hidden" value={selectedTenant.id} />
                <Field label="Device">
                  <select name="deviceId" required>
                    {data.devices.map((device) => (
                      <option key={device.id} value={device.id}>
                        {device.serialNumber}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Student ID">
                  <input name="studentId" placeholder="Optional" />
                </Field>
                <Field label="Class ID">
                  <input name="classId" placeholder="Optional" />
                </Field>
                <Field label="Tags">
                  <input name="tags" placeholder="pilot, grade-4" />
                </Field>
                <Field label="Reason">
                  <input name="reason" placeholder="Assigned during rollout" />
                </Field>
                <SubmitButton>Save assignment</SubmitButton>
              </form>
            </ActionPanel>
          </PageSection>
        ) : null}

        {selectedTenant && selectedDevice ? (
          <PageSection kicker="Remote operations" title="Command Center">
            <div className="form-grid">
              <ActionPanel title="Queue device command">
                <form action={queueDeviceCommandAction} className="stacked-form">
                  <input name="tenantId" type="hidden" value={selectedTenant.id} />
                  <input name="deviceId" type="hidden" value={selectedDevice.id} />
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
                      <option value="REQUEST_CHECK_IN">Request check-in</option>
                      <option value="POLICY_REFRESH">Refresh policy</option>
                      <option value="LOCK">Lock</option>
                      <option value="UNLOCK">Unlock</option>
                      <option value="SEND_MESSAGE">Send message</option>
                      <option value="RETIRE">Retire device</option>
                    </select>
                  </Field>
                  <Field label="Message">
                    <input name="message" placeholder="Shown only for message commands" />
                  </Field>
                  <div className="form-row">
                    <Field label="TTL minutes">
                      <input defaultValue="60" min="1" name="ttlMinutes" type="number" />
                    </Field>
                    <Field label="Attempts">
                      <input defaultValue="3" min="1" name="maxAttempts" type="number" />
                    </Field>
                  </div>
                  <label className="check-field">
                    <input name="confirmed" type="checkbox" />
                    <span>Confirm high-impact operation</span>
                  </label>
                  <Field label="Reason">
                    <input name="reason" placeholder="Support or classroom operation" />
                  </Field>
                  <SubmitButton>Queue command</SubmitButton>
                </form>
              </ActionPanel>

              <ActionPanel title="Confirmed wipe">
                <form action={queueWipeDeviceAction} className="stacked-form">
                  <input name="tenantId" type="hidden" value={selectedTenant.id} />
                  <input name="deviceId" type="hidden" value={selectedDevice.id} />
                  <p className="form-help">
                    Destructive reset requires the exact serial number and a
                    reason. Use only for approved lost-device or redeployment cases.
                  </p>
                  <Field label="Serial confirmation">
                    <input
                      name="confirmationSerialNumber"
                      placeholder={selectedDevice.serialNumber}
                      required
                    />
                  </Field>
                  <Field label="Reason">
                    <input name="reason" placeholder="Approved wipe request" required />
                  </Field>
                  <label className="check-field">
                    <input name="preserveFactoryResetProtection" type="checkbox" />
                    <span>Preserve factory reset protection</span>
                  </label>
                  <button className="submit-button danger" type="submit">
                    Queue wipe
                  </button>
                </form>
              </ActionPanel>

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
                </div>
              </ActionPanel>
            </div>
          </PageSection>
        ) : null}

        <PageSection title="Managed Tablets">
          {data.devices.length > 0 ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Serial</th>
                    <th>Model</th>
                    <th>Status</th>
                    <th>Health</th>
                    <th>Policy</th>
                    <th>Assignment</th>
                    <th>Last check-in</th>
                  </tr>
                </thead>
                <tbody>
                  {data.devices.map((device) => (
                    <tr key={device.id}>
                      <td>
                        <a className="table-link" href={`/devices?deviceId=${device.id}`}>
                          {device.serialNumber}
                        </a>
                      </td>
                      <td>{device.model ?? device.manufacturer ?? "Android tablet"}</td>
                      <td>
                        <StatusPill tone={statusTone(device.status)}>
                          {humanize(device.status)}
                        </StatusPill>
                      </td>
                      <td>{humanize(device.health)}</td>
                      <td>{device.policyVersion ? `v${device.policyVersion}` : "Unassigned"}</td>
                      <td>{device.studentId ?? device.classId ?? "Quarantine"}</td>
                      <td>{formatDateTime(device.lastCheckInAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title="No managed tablets enrolled"
              body="Create an enrollment batch, scan the QR on school-owned Android tablets, and devices will appear here."
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
                      <td>{command.reason ?? command.failureReason ?? "Not recorded"}</td>
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
                      <td>{diagnostic.health ? humanize(diagnostic.health) : "Unknown"}</td>
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

function statusTone(status: string): "neutral" | "good" | "warning" | "critical" {
  if (status === "ONLINE") return "good";
  if (status === "LOST" || status === "NON_COMPLIANT" || status === "ENROLLMENT_FAILED") {
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

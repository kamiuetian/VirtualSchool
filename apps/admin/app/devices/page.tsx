import { AppShell } from "../../components/app-shell";
import { EmptyState, PageSection, StatCard, StatusPill } from "../../components/ui";
import { getAdminData } from "../../lib/api";
import { formatCount, formatDateTime, humanize } from "../../lib/format";

export const dynamic = "force-dynamic";

export default async function DevicesPage() {
  const data = await getAdminData();
  const nonCompliant = data.devices.filter(
    (device) => device.compliance !== "COMPLIANT" && device.compliance !== "UNKNOWN",
  );
  const offline = data.devices.filter((device) => device.status === "OFFLINE");
  const quarantined = data.devices.filter((device) => !device.studentId && !device.classId);

  return (
    <AppShell connectionIssue={data.connectionIssue} tenant={data.selectedTenant}>
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
                      <td>{device.serialNumber}</td>
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

import { AppShell } from "../../components/app-shell";
import {
  EmptyState,
  PageSection,
  StatCard,
  StatusPill,
} from "../../components/ui";
import { getAdminData } from "../../lib/api";
import { formatCount, formatDateTime, humanize } from "../../lib/format";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const data = await getAdminData();
  const deviceTotals = data.deviceInventory?.totals;
  const policyTotals = data.policyDeploymentReport?.totals;
  const appTotals = data.appDeploymentReport?.totals;

  return (
    <AppShell connectionIssue={data.connectionIssue} tenant={data.selectedTenant}>
      <div className="content-stack">
        <PageSection
          actions={
            data.selectedTenant ? (
              <a className="small-button primary" href="/reports/device-inventory.csv">
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
              tone={(policyTotals?.failedDeployments ?? 0) > 0 ? "critical" : "good"}
              value={formatCount(policyTotals?.failedDeployments ?? 0)}
            />
            <StatCard
              label="App deployment failures"
              tone={(appTotals?.failedDeployments ?? 0) > 0 ? "critical" : "good"}
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
                      <td>{device.model ?? device.manufacturer ?? "Android tablet"}</td>
                      <td>
                        <StatusPill tone={device.status === "ONLINE" ? "good" : "neutral"}>
                          {humanize(device.status)}
                        </StatusPill>
                      </td>
                      <td>{humanize(device.compliance)}</td>
                      <td>{device.policyVersion ? `v${device.policyVersion}` : "Unassigned"}</td>
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

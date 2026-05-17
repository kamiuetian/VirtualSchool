import { AppShell } from "../../components/app-shell";
import { EmptyState, PageSection, StatCard, StatusPill } from "../../components/ui";
import { getAdminData } from "../../lib/api";
import { formatCount, formatDateTime, humanize } from "../../lib/format";

export const dynamic = "force-dynamic";

export default async function AppsPage() {
  const data = await getAdminData();
  const approved = data.apps.filter((app) => app.approvalStatus === "APPROVED");
  const blocked = data.apps.filter((app) => app.approvalStatus === "BLOCKED");

  return (
    <AppShell connectionIssue={data.connectionIssue} tenant={data.selectedTenant}>
      <div className="content-stack">
        <PageSection kicker="Learning access" title="Apps And Web Catalog">
          <section className="stat-grid" aria-label="App catalog summary">
            <StatCard label="Catalog apps" value={formatCount(data.apps.length)} />
            <StatCard label="Approved" tone="good" value={formatCount(approved.length)} />
            <StatCard
              label="Blocked"
              tone={blocked.length > 0 ? "warning" : "neutral"}
              value={formatCount(blocked.length)}
            />
            <StatCard
              label="Policy-linked packages"
              value={formatCount(
                new Set(
                  data.policies.flatMap((policy) => policy.rules.approvedAppPackageIds),
                ).size,
              )}
            />
          </section>
        </PageSection>

        <PageSection title="Approved App Catalog">
          {data.apps.length > 0 ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>App</th>
                    <th>Package ID</th>
                    <th>Grades</th>
                    <th>Install rule</th>
                    <th>Status</th>
                    <th>Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {data.apps.map((app) => (
                    <tr key={app.id}>
                      <td>{app.name}</td>
                      <td>{app.packageId}</td>
                      <td>{app.approvedGrades.length > 0 ? app.approvedGrades.join(", ") : "All"}</td>
                      <td>{humanize(app.installRules?.installType ?? "AVAILABLE")}</td>
                      <td>
                        <StatusPill tone={app.approvalStatus === "APPROVED" ? "good" : "warning"}>
                          {humanize(app.approvalStatus)}
                        </StatusPill>
                      </td>
                      <td>{formatDateTime(app.updatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title="No apps in catalog"
              body="Approve educational apps and web shortcuts before assigning policies to classes or devices."
            />
          )}
        </PageSection>

        <PageSection title="Web Access Policy">
          {data.policies.length > 0 ? (
            <div className="card-grid compact">
              {data.policies.map((policy) => (
                <article className="record-card" key={policy.id}>
                  <div>
                    <strong>{policy.name}</strong>
                    <span>{humanize(policy.rules.defaultWebAccess)} by default</span>
                  </div>
                  <StatusPill>
                    {policy.rules.urlAllowlist.length} allowed, {policy.rules.urlBlocklist.length} blocked
                  </StatusPill>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No web rules configured"
              body="Policy web rules will show the allowlist, blocklist, and default-deny posture for each learning mode."
            />
          )}
        </PageSection>
      </div>
    </AppShell>
  );
}

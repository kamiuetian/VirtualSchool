import { AppShell } from "../../components/app-shell";
import { EmptyState, PageSection, StatCard, StatusPill } from "../../components/ui";
import { getAdminData } from "../../lib/api";
import { formatCount, humanize } from "../../lib/format";

export const dynamic = "force-dynamic";

export default async function TenantsPage() {
  const data = await getAdminData();

  return (
    <AppShell connectionIssue={data.connectionIssue} tenant={data.selectedTenant}>
      <div className="content-stack">
        <PageSection kicker="Schools" title="Tenant Directory">
          <section className="stat-grid" aria-label="School tenant summary">
            <StatCard label="Schools" value={formatCount(data.tenants.length)} />
            <StatCard
              label="Active"
              tone="good"
              value={formatCount(data.tenants.filter((tenant) => tenant.status === "ACTIVE").length)}
            />
            <StatCard
              label="Pilot"
              value={formatCount(data.tenants.filter((tenant) => tenant.status === "PILOT").length)}
            />
            <StatCard label="Plans" value={formatCount(new Set(data.tenants.map((tenant) => tenant.planKey)).size)} />
          </section>
        </PageSection>

        <PageSection title="School Profiles">
          {data.tenants.length > 0 ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>School</th>
                    <th>Country</th>
                    <th>Timezone</th>
                    <th>Plan</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.tenants.map((tenant) => (
                    <tr key={tenant.id}>
                      <td>{tenant.name}</td>
                      <td>{tenant.country}</td>
                      <td>{tenant.timezone}</td>
                      <td>{tenant.planKey}</td>
                      <td>
                        <StatusPill tone={tenant.status === "ACTIVE" ? "good" : "neutral"}>
                          {humanize(tenant.status)}
                        </StatusPill>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title="No schools connected"
              body="Create the first school tenant to begin onboarding staff, classes, policies, and devices."
            />
          )}
        </PageSection>
      </div>
    </AppShell>
  );
}

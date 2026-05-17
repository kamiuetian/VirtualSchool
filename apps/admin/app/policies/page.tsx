import { AppShell } from "../../components/app-shell";
import { EmptyState, PageSection, StatCard, StatusPill } from "../../components/ui";
import { getAdminData } from "../../lib/api";
import { formatCount, formatDateTime, humanize } from "../../lib/format";

export const dynamic = "force-dynamic";

export default async function PoliciesPage() {
  const data = await getAdminData();
  const published = data.policies.filter((policy) => policy.status === "PUBLISHED");

  return (
    <AppShell connectionIssue={data.connectionIssue} tenant={data.selectedTenant}>
      <div className="content-stack">
        <PageSection kicker="Learning controls" title="Policies And Modes">
          <section className="stat-grid" aria-label="Policy summary">
            <StatCard label="Policies" value={formatCount(data.policies.length)} />
            <StatCard label="Published" tone="good" value={formatCount(published.length)} />
            <StatCard label="Assignments" value={formatCount(data.policyAssignments.length)} />
            <StatCard
              label="MDM publish failures"
              tone={
                data.policies.some((policy) => policy.mdmPublishStatus === "FAILED")
                  ? "critical"
                  : "good"
              }
              value={formatCount(
                data.policies.filter((policy) => policy.mdmPublishStatus === "FAILED").length,
              )}
            />
          </section>
        </PageSection>

        <PageSection title="Policy Library">
          {data.policies.length > 0 ? (
            <div className="card-grid">
              {data.policies.map((policy) => (
                <article className="record-card" key={policy.id}>
                  <div>
                    <strong>{policy.name}</strong>
                    <span>{humanize(policy.rules.mode)}</span>
                  </div>
                  <StatusPill tone={policy.status === "PUBLISHED" ? "good" : "neutral"}>
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
                        <StatusPill tone={assignment.active ? "good" : "neutral"}>
                          {assignment.active ? "Active" : "Inactive"}
                        </StatusPill>
                      </td>
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
      </div>
    </AppShell>
  );
}

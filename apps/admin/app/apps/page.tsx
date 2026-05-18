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
  bulkCreateAppsAction,
  createAppAction,
  deployAppAction,
} from "../../lib/actions";
import { getAdminData } from "../../lib/api";
import { roleCan } from "../../lib/auth/portal-access";
import { formatCount, formatDateTime, humanize } from "../../lib/format";

export const dynamic = "force-dynamic";

export default async function AppsPage() {
  const data = await getAdminData("/apps");
  const selectedTenant = data.selectedTenant;
  const canDeployApps = roleCan(data.session.role, "device:command");
  const approved = data.apps.filter((app) => app.approvalStatus === "APPROVED");
  const blocked = data.apps.filter((app) => app.approvalStatus === "BLOCKED");

  return (
    <AppShell connectionIssue={data.connectionIssue} tenant={selectedTenant}>
      <div className="content-stack">
        <PageSection kicker="Learning access" title="Apps And Web Catalog">
          <section className="stat-grid" aria-label="App catalog summary">
            <StatCard
              label="Catalog apps"
              value={formatCount(data.apps.length)}
            />
            <StatCard
              label="Approved"
              tone="good"
              value={formatCount(approved.length)}
            />
            <StatCard
              label="Blocked"
              tone={blocked.length > 0 ? "warning" : "neutral"}
              value={formatCount(blocked.length)}
            />
            <StatCard
              label="Policy-linked packages"
              value={formatCount(
                new Set(
                  data.policies.flatMap(
                    (policy) => policy.rules.approvedAppPackageIds,
                  ),
                ).size,
              )}
            />
          </section>
        </PageSection>

        {selectedTenant ? (
          <PageSection kicker="Catalog action" title="Add Approved App">
            <div className="form-grid two">
              <ActionPanel title="Managed Google Play app">
                <form action={createAppAction} className="stacked-form">
                  <input
                    name="tenantId"
                    type="hidden"
                    value={selectedTenant.id}
                  />
                  <Field label="App name">
                    <input
                      name="name"
                      placeholder="Google Classroom"
                      required
                    />
                  </Field>
                  <Field label="Package ID">
                    <input
                      name="packageId"
                      placeholder="com.google.android.apps.classroom"
                      required
                    />
                  </Field>
                  <div className="form-row">
                    <Field label="Category">
                      <input name="category" placeholder="Learning" />
                    </Field>
                    <Field label="Grades">
                      <input name="approvedGrades" placeholder="1, 2, 3" />
                    </Field>
                  </div>
                  <div className="form-row">
                    <Field label="Install rule">
                      <select name="installType" defaultValue="AVAILABLE">
                        <option value="AVAILABLE">Available</option>
                        <option value="FORCE_INSTALLED">Force installed</option>
                        <option value="BLOCKED">Blocked</option>
                      </select>
                    </Field>
                    <Field label="Status">
                      <select name="approvalStatus" defaultValue="APPROVED">
                        <option value="APPROVED">Approved</option>
                        <option value="PENDING_REVIEW">Pending review</option>
                        <option value="DEPRECATED">Deprecated</option>
                        <option value="BLOCKED">Blocked</option>
                      </select>
                    </Field>
                  </div>
                  <SubmitButton>Add app</SubmitButton>
                </form>
              </ActionPanel>

              <ActionPanel title="Bulk app catalog import">
                <form action={bulkCreateAppsAction} className="stacked-form">
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
                      placeholder="name,packageId,category,approvedGrades,installType,approvalStatus"
                    />
                  </Field>
                  <p className="form-help">
                    Use package IDs from Managed Google Play and set install
                    rules to AVAILABLE, FORCE_INSTALLED, or BLOCKED.
                  </p>
                  <a className="small-button" href="/apps/sample.csv">
                    Download app catalog sample CSV
                  </a>
                  <SubmitButton>Import apps</SubmitButton>
                </form>
              </ActionPanel>
            </div>
          </PageSection>
        ) : null}

        {selectedTenant && canDeployApps && data.apps.length > 0 ? (
          <PageSection kicker="Deployment" title="Install Or Remove Apps">
            <ActionPanel title="Queue app deployment">
              <form action={deployAppAction} className="inline-form wide">
                <input
                  name="tenantId"
                  type="hidden"
                  value={selectedTenant.id}
                />
                <Field label="App">
                  <select name="appId" required>
                    {data.apps.map((app) => (
                      <option key={app.id} value={app.id}>
                        {app.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Action">
                  <select name="action" defaultValue="INSTALL">
                    <option value="INSTALL">Install</option>
                    <option value="REMOVE">Remove</option>
                  </select>
                </Field>
                <Field label="Scope">
                  <select name="scope" defaultValue="CLASS">
                    <option value="TENANT">Whole school</option>
                    <option value="GRADE">Grade</option>
                    <option value="CLASS">Class</option>
                    <option value="STUDENT">Student</option>
                    <option value="DEVICE">Device</option>
                  </select>
                </Field>
                <Field label="Target ID">
                  <input name="scopeId" placeholder="Omit for whole school" />
                </Field>
                <Field label="Reason">
                  <input name="reason" placeholder="Curriculum app rollout" />
                </Field>
                <Field label="TTL minutes">
                  <input
                    defaultValue="120"
                    min="1"
                    name="ttlMinutes"
                    type="number"
                  />
                </Field>
                <SubmitButton>Queue deployment</SubmitButton>
              </form>
            </ActionPanel>
          </PageSection>
        ) : null}

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
                      <td>
                        {app.approvedGrades.length > 0
                          ? app.approvedGrades.join(", ")
                          : "All"}
                      </td>
                      <td>
                        {humanize(app.installRules?.installType ?? "AVAILABLE")}
                      </td>
                      <td>
                        <StatusPill
                          tone={
                            app.approvalStatus === "APPROVED"
                              ? "good"
                              : "warning"
                          }
                        >
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
                    <span>
                      {humanize(policy.rules.defaultWebAccess)} by default
                    </span>
                  </div>
                  <StatusPill>
                    {policy.rules.urlAllowlist.length} allowed,{" "}
                    {policy.rules.urlBlocklist.length} blocked
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

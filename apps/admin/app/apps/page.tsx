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
  createContentLibraryItemAction,
  updateContentLibraryItemAction,
} from "../../lib/actions";
import { getAdminData, getContentLibrary } from "../../lib/api";
import { roleCan } from "../../lib/auth/portal-access";
import { formatCount, formatDateTime, humanize } from "../../lib/format";

export const dynamic = "force-dynamic";

export default async function AppsPage() {
  const data = await getAdminData("/apps");
  const selectedTenant = data.selectedTenant;
  const library = selectedTenant
    ? await getContentLibrary(selectedTenant.id)
    : { items: [], report: null, connectionIssue: false };
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
          <PageSection
            kicker="Curriculum resources"
            title="Categorized Content Library"
          >
            <section className="stat-grid" aria-label="Content library summary">
              <StatCard
                label="Available"
                tone="good"
                value={formatCount(library.report?.active ?? 0)}
              />
              <StatCard
                label="Expired"
                tone={
                  (library.report?.expired ?? 0) > 0 ? "warning" : "neutral"
                }
                value={formatCount(library.report?.expired ?? 0)}
              />
              <StatCard
                label="Expiring in 30 days"
                value={formatCount(library.report?.expiringWithin30Days ?? 0)}
              />
              <StatCard
                label="Archived"
                value={formatCount(library.report?.archived ?? 0)}
              />
            </section>
            <ActionPanel title="Approve a learning resource">
              <form
                action={createContentLibraryItemAction}
                className="stacked-form"
              >
                <input
                  name="tenantId"
                  type="hidden"
                  value={selectedTenant.id}
                />
                <div className="form-row">
                  <Field label="Title">
                    <input name="title" required />
                  </Field>
                  <Field label="Type">
                    <select name="type" defaultValue="LINK">
                      <option>APP</option>
                      <option>LINK</option>
                      <option>PDF</option>
                      <option>WORKSHEET</option>
                      <option>VIDEO</option>
                      <option>LMS</option>
                      <option>EXAM</option>
                    </select>
                  </Field>
                  <Field label="Category">
                    <input name="category" placeholder="Mathematics" required />
                  </Field>
                </div>
                <Field label="Package ID or HTTPS URL">
                  <input name="locator" required />
                </Field>
                <Field label="Description">
                  <textarea name="description" />
                </Field>
                <div className="form-row">
                  <Field label="Grades">
                    <input name="grades" placeholder="5, 6" />
                  </Field>
                  <Field label="Subjects">
                    <input name="subjects" placeholder="Mathematics, Science" />
                  </Field>
                  <Field label="Classes">
                    <select multiple name="classIds">
                      {data.classes.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Expires">
                    <input name="expiresAt" type="datetime-local" />
                  </Field>
                </div>
                <Field label="Offline lesson pack">
                  <label>
                    <input name="offlineEnabled" type="checkbox" /> Cache this
                    PDF, worksheet, or video on managed devices
                  </label>
                </Field>
                <div className="form-row">
                  <Field label="Content version">
                    <input min="1" name="offlineVersion" type="number" />
                  </Field>
                  <Field label="Size (bytes)">
                    <input min="1" name="offlineSizeBytes" type="number" />
                  </Field>
                  <Field label="SHA-256">
                    <input
                      maxLength={64}
                      name="offlineSha256"
                      pattern="[a-fA-F0-9]{64}"
                    />
                  </Field>
                  <Field label="Available under policies">
                    <select multiple name="offlinePolicyIds">
                      {data.policies
                        .filter((policy) => policy.status === "PUBLISHED")
                        .map((policy) => (
                          <option key={policy.id} value={policy.id}>
                            {policy.name} v{policy.version}
                          </option>
                        ))}
                    </select>
                  </Field>
                </div>
                <SubmitButton>Add resource</SubmitButton>
              </form>
            </ActionPanel>
            {library.items.length > 0 ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Resource</th>
                      <th>Category</th>
                      <th>Scope</th>
                      <th>Expiry</th>
                      <th>Status</th>
                      <th>Offline</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {library.items.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <strong>{item.title}</strong>
                          <br />
                          {humanize(item.type)}
                        </td>
                        <td>
                          {item.offlineEnabled
                            ? `v${item.offlineVersion} · ${item.offlinePolicyIds.length} policies`
                            : "Online only"}
                        </td>
                        <td>
                          {item.category}
                          <br />
                          {item.subjects.join(", ") || "All subjects"}
                        </td>
                        <td>
                          {item.grades.length
                            ? `Grades ${item.grades.join(", ")}`
                            : "All grades"}
                          {item.classIds.length
                            ? ` · ${item.classIds.length} classes`
                            : ""}
                        </td>
                        <td>
                          {item.expiresAt
                            ? formatDateTime(item.expiresAt)
                            : "No expiry"}
                        </td>
                        <td>
                          <StatusPill
                            tone={
                              item.expired || item.status === "ARCHIVED"
                                ? "warning"
                                : "good"
                            }
                          >
                            {item.expired ? "Expired" : humanize(item.status)}
                          </StatusPill>
                        </td>
                        <td>
                          <form action={updateContentLibraryItemAction}>
                            <input
                              name="tenantId"
                              type="hidden"
                              value={selectedTenant.id}
                            />
                            <input
                              name="itemId"
                              type="hidden"
                              value={item.id}
                            />
                            <input
                              name="status"
                              type="hidden"
                              value={
                                item.status === "ACTIVE" ? "ARCHIVED" : "ACTIVE"
                              }
                            />
                            <SubmitButton>
                              {item.status === "ACTIVE" ? "Archive" : "Restore"}
                            </SubmitButton>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                title="No content approved"
                body="Add apps, links, documents, videos, LMS, or exam resources and scope them to the intended learners."
              />
            )}
          </PageSection>
        ) : null}

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

import { AppShell } from "../../components/app-shell";
import {
  ActionPanel,
  EmptyState,
  Field,
  PageSection,
  StatusPill,
  SubmitButton,
} from "../../components/ui";
import {
  authorizeClassroomAction,
  mapClassroomCourseAction,
  mapClassroomIdentityAction,
  retryClassroomSyncAction,
  startClassroomSyncAction,
} from "../../lib/actions";
import { getAdminData, getClassroomIntegration } from "../../lib/api";

export const dynamic = "force-dynamic";
export default async function IntegrationsPage() {
  const data = await getAdminData("/integrations");
  const tenant = data.selectedTenant;
  const classroomResult = tenant
    ? await getClassroomIntegration(tenant.id)
    : { integration: null, connectionIssue: false };
  const integration = classroomResult.integration;
  return (
    <AppShell
      connectionIssue={data.connectionIssue || classroomResult.connectionIssue}
      tenant={tenant}
    >
      <div className="content-stack">
        <PageSection kicker="Education ecosystem" title="Google Classroom">
          {tenant ? (
            <div className="form-grid two">
              <ActionPanel
                title={
                  integration ? "Update authorization" : "Authorize connection"
                }
              >
                <form
                  action={authorizeClassroomAction}
                  className="stacked-form"
                >
                  <input name="tenantId" type="hidden" value={tenant.id} />
                  <Field label="Credential reference">
                    <input
                      name="credentialReference"
                      placeholder="arn:aws:secretsmanager:..."
                      defaultValue={integration?.credentialReference}
                      required
                    />
                  </Field>
                  <Field label="Delegated admin email">
                    <input
                      name="delegatedAdminEmail"
                      type="email"
                      defaultValue={integration?.delegatedAdminEmail}
                      required
                    />
                  </Field>
                  <small>
                    Store credentials in the configured secret manager; this
                    form accepts references only.
                  </small>
                  <SubmitButton>Authorize and validate</SubmitButton>
                </form>
              </ActionPanel>
              <ActionPanel title="Map a course">
                <form
                  action={mapClassroomCourseAction}
                  className="stacked-form"
                >
                  <input name="tenantId" type="hidden" value={tenant.id} />
                  <Field label="Virtual School class">
                    <select name="classId" required>
                      <option value="">Select class</option>
                      {data.classes.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} · {item.grade}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Classroom course ID">
                    <input name="externalCourseId" required />
                  </Field>
                  <Field label="Classroom course name">
                    <input name="externalCourseName" />
                  </Field>
                  <label>
                    <input name="syncRoster" type="checkbox" defaultChecked />{" "}
                    Allow roster sync
                  </label>
                  <label>
                    <input name="syncMaterials" type="checkbox" /> Allow
                    material sync
                  </label>
                  <SubmitButton>Save course mapping</SubmitButton>
                </form>
              </ActionPanel>
              <ActionPanel title="Map an identity">
                <form
                  action={mapClassroomIdentityAction}
                  className="stacked-form"
                >
                  <input name="tenantId" type="hidden" value={tenant.id} />
                  <Field label="Local identity type">
                    <select name="localType">
                      <option value="STUDENT">Student</option>
                      <option value="TEACHER">Teacher</option>
                    </select>
                  </Field>
                  <Field label="Local record ID">
                    <input
                      name="localId"
                      placeholder="UUID from roster"
                      required
                    />
                  </Field>
                  <Field label="Classroom user ID">
                    <input name="externalUserId" required />
                  </Field>
                  <Field label="Classroom email">
                    <input name="externalEmail" type="email" />
                  </Field>
                  <SubmitButton>Save identity mapping</SubmitButton>
                </form>
              </ActionPanel>
            </div>
          ) : null}
        </PageSection>
        <PageSection title="Selective sync">
          {tenant && integration?.courseMappings.length ? (
            <ActionPanel title="Choose mapped courses and data">
              <form action={startClassroomSyncAction} className="stacked-form">
                <input name="tenantId" type="hidden" value={tenant.id} />
                {integration.courseMappings
                  .filter((item) => item.enabled)
                  .map((item) => (
                    <label key={item.id}>
                      <input
                        name="courseMappingIds"
                        type="checkbox"
                        value={item.id}
                      />{" "}
                      {item.externalCourseName ?? item.externalCourseId}
                    </label>
                  ))}
                <div className="form-row">
                  <label>
                    <input name="syncRoster" type="checkbox" /> Rosters
                  </label>
                  <label>
                    <input name="syncMaterials" type="checkbox" /> Materials
                  </label>
                </div>
                <SubmitButton>Queue selected sync</SubmitButton>
              </form>
            </ActionPanel>
          ) : (
            <EmptyState
              title="No mapped courses"
              body="Authorize Classroom and map a local class before starting a selective sync."
            />
          )}
        </PageSection>
        <PageSection title="Sync outcomes">
          {tenant && integration?.syncRuns.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Created</th>
                    <th>Selection</th>
                    <th>Attempt</th>
                    <th>Status</th>
                    <th>Outcome</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {integration.syncRuns.map((run) => (
                    <tr key={run.id}>
                      <td>{new Date(run.createdAt).toLocaleString()}</td>
                      <td>
                        {run.requestedCourseIds.length} courses ·{" "}
                        {[
                          run.syncRoster && "rosters",
                          run.syncMaterials && "materials",
                        ]
                          .filter(Boolean)
                          .join(", ")}
                      </td>
                      <td>{run.attempt}</td>
                      <td>
                        <StatusPill
                          tone={
                            run.status === "FAILED"
                              ? "warning"
                              : run.status === "SUCCEEDED"
                                ? "good"
                                : "neutral"
                          }
                        >
                          {run.status}
                        </StatusPill>
                      </td>
                      <td>
                        {run.errorMessage ??
                          (run.outcome
                            ? JSON.stringify(run.outcome)
                            : "Pending worker")}
                      </td>
                      <td>
                        {run.status === "FAILED" ? (
                          <form action={retryClassroomSyncAction}>
                            <input
                              name="tenantId"
                              type="hidden"
                              value={tenant.id}
                            />
                            <input name="runId" type="hidden" value={run.id} />
                            <button className="small-button primary">
                              Retry
                            </button>
                          </form>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title="No sync runs"
              body="Queued, completed, and retryable sync outcomes appear here."
            />
          )}
        </PageSection>
      </div>
    </AppShell>
  );
}

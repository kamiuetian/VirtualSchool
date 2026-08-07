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
  configureLmsAction,
  mapLmsCourseAction,
  testLmsAction,
  disableLmsAction,
  configureEducationConnectionAction,
  mapEducationResourceAction,
} from "../../lib/actions";
import {
  getAdminData,
  getClassroomIntegration,
  getLmsIntegrations,
  getEducationResources,
} from "../../lib/api";

export const dynamic = "force-dynamic";
export default async function IntegrationsPage() {
  const data = await getAdminData("/integrations");
  const tenant = data.selectedTenant;
  const classroomResult = tenant
    ? await getClassroomIntegration(tenant.id)
    : { integration: null, connectionIssue: false };
  const integration = classroomResult.integration;
  const lmsResult = tenant
    ? await getLmsIntegrations(tenant.id)
    : { integrations: [], connectionIssue: false };
  const educationResult = tenant
    ? await getEducationResources(tenant.id)
    : { integrations: [], connectionIssue: false };
  return (
    <AppShell
      connectionIssue={
        data.connectionIssue ||
        classroomResult.connectionIssue ||
        lmsResult.connectionIssue ||
        educationResult.connectionIssue
      }
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
        <PageSection kicker="Course links" title="Moodle and Canvas">
          {tenant ? (
            <div className="form-grid two">
              {["MOODLE", "CANVAS"].map((provider) => {
                const current = lmsResult.integrations.find(
                  (item) => item.provider === provider,
                );
                return (
                  <ActionPanel
                    key={provider}
                    title={provider === "MOODLE" ? "Moodle" : "Canvas"}
                  >
                    <form action={configureLmsAction} className="stacked-form">
                      <input name="tenantId" type="hidden" value={tenant.id} />
                      <input name="provider" type="hidden" value={provider} />
                      <Field label="HTTPS base URL">
                        <input
                          name="baseUrl"
                          type="url"
                          defaultValue={current?.baseUrl}
                          required
                        />
                      </Field>
                      <Field label="Credential reference">
                        <input
                          name="credentialReference"
                          defaultValue={current?.credentialReference}
                          required
                        />
                      </Field>
                      <SubmitButton>
                        {current ? "Update and enable" : "Configure"}
                      </SubmitButton>
                    </form>
                    {current ? (
                      <>
                        <form
                          action={mapLmsCourseAction}
                          className="stacked-form"
                        >
                          <input
                            name="tenantId"
                            type="hidden"
                            value={tenant.id}
                          />
                          <input
                            name="provider"
                            type="hidden"
                            value={provider}
                          />
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
                          <Field label="External course ID">
                            <input name="externalCourseId" required />
                          </Field>
                          <Field label="Launcher label">
                            <input name="displayName" required />
                          </Field>
                          <Field label="Course launch URL">
                            <input name="launchUrl" type="url" required />
                          </Field>
                          <SubmitButton>Save launcher link</SubmitButton>
                        </form>
                        <div className="form-row">
                          <form action={testLmsAction}>
                            <input
                              name="tenantId"
                              type="hidden"
                              value={tenant.id}
                            />
                            <input
                              name="provider"
                              type="hidden"
                              value={provider}
                            />
                            <button className="small-button primary">
                              Test connection
                            </button>
                          </form>
                          <form action={disableLmsAction}>
                            <input
                              name="tenantId"
                              type="hidden"
                              value={tenant.id}
                            />
                            <input
                              name="provider"
                              type="hidden"
                              value={provider}
                            />
                            <button className="small-button">Disable</button>
                          </form>
                        </div>
                        <small>
                          {current.status} · Last test:{" "}
                          {current.lastTestOutcome ?? "not tested"} ·{" "}
                          {current.courseMappings.length} mapped courses
                        </small>
                      </>
                    ) : null}
                  </ActionPanel>
                );
              })}
            </div>
          ) : null}
        </PageSection>
        <PageSection
          kicker="Live learning"
          title="Microsoft 365 and approved meeting links"
        >
          {tenant ? (
            <div className="form-grid two">
              {(["MICROSOFT_365", "ZOOM", "GOOGLE_MEET"] as const).map(
                (connectionProvider) => {
                  const current = educationResult.integrations.find(
                    (item) => item.provider === connectionProvider,
                  );
                  return (
                    <ActionPanel
                      key={connectionProvider}
                      title={connectionProvider.replaceAll("_", " ")}
                    >
                      <form
                        action={configureEducationConnectionAction}
                        className="stacked-form"
                      >
                        <input
                          name="tenantId"
                          type="hidden"
                          value={tenant.id}
                        />
                        <input
                          name="provider"
                          type="hidden"
                          value={connectionProvider}
                        />
                        <Field label="Credential reference">
                          <input
                            name="credentialReference"
                            defaultValue={current?.credentialReference}
                            required
                          />
                        </Field>
                        <SubmitButton>
                          {current ? "Update and enable" : "Authorize"}
                        </SubmitButton>
                      </form>
                      {current ? (
                        <form
                          action={mapEducationResourceAction}
                          className="stacked-form"
                        >
                          <input
                            name="tenantId"
                            type="hidden"
                            value={tenant.id}
                          />
                          <input
                            name="connectionProvider"
                            type="hidden"
                            value={connectionProvider}
                          />
                          <Field label="Resource type">
                            <select name="provider" required>
                              {connectionProvider === "MICROSOFT_365" ? (
                                <>
                                  <option value="MICROSOFT_365">
                                    Microsoft 365
                                  </option>
                                  <option value="TEAMS">Teams</option>
                                </>
                              ) : (
                                <option value={connectionProvider}>
                                  {connectionProvider.replaceAll("_", " ")}
                                </option>
                              )}
                            </select>
                          </Field>
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
                          <Field label="External resource ID">
                            <input name="externalId" required />
                          </Field>
                          <Field label="Display name">
                            <input name="displayName" required />
                          </Field>
                          <Field label="Approved HTTPS launch URL">
                            <input name="launchUrl" type="url" required />
                          </Field>
                          <SubmitButton>Approve resource</SubmitButton>
                          <small>
                            {current.resources.length} class-scoped resources
                          </small>
                        </form>
                      ) : null}
                    </ActionPanel>
                  );
                },
              )}
            </div>
          ) : null}
        </PageSection>
      </div>
    </AppShell>
  );
}

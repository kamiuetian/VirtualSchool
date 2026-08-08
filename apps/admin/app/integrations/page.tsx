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
  reconcileSisAction,
  retrySisAction,
  configureWebhookAction,
  rotateWebhookSecretAction,
  setWebhookEnabledAction,
  authorizeGoogleWorkspaceAction,
  mapGoogleWorkspaceOuAction,
} from "../../lib/actions";
import {
  getAdminData,
  getClassroomIntegration,
  getLmsIntegrations,
  getEducationResources,
  getSisOperations,
  getWebhookEndpoints,
  getGoogleWorkspaceIntegration,
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
  const sisResult = tenant
    ? await getSisOperations(tenant.id)
    : { operations: null, connectionIssue: false };
  const webhookResult = tenant
    ? await getWebhookEndpoints(tenant.id)
    : { endpoints: [], connectionIssue: false };
  const workspaceResult = tenant
    ? await getGoogleWorkspaceIntegration(tenant.id)
    : { integration: null, connectionIssue: false };
  const workspace = workspaceResult.integration;
  return (
    <AppShell
      connectionIssue={
        data.connectionIssue ||
        classroomResult.connectionIssue ||
        lmsResult.connectionIssue ||
        educationResult.connectionIssue ||
        sisResult.connectionIssue ||
        webhookResult.connectionIssue
        || workspaceResult.connectionIssue
      }
      tenant={tenant}
    >
      <div className="content-stack">
        <PageSection kicker="ChromeOS management" title="Google Workspace">
          {tenant ? (
            <div className="form-grid two">
              <ActionPanel title="Guided authorization">
                <form action={authorizeGoogleWorkspaceAction} className="stacked-form">
                  <input name="tenantId" type="hidden" value={tenant.id} />
                  <Field label="Google customer ID"><input defaultValue={workspace?.customerId} name="customerId" required /></Field>
                  <Field label="Delegated admin email"><input defaultValue={workspace?.delegatedAdminEmail} name="delegatedAdminEmail" type="email" required /></Field>
                  <Field label="Service-account secret reference"><input defaultValue={workspace?.credentialReference} name="credentialReference" placeholder="secret://google-workspace" required /></Field>
                  <small>Only an external secret reference is stored. Domain-wide delegation must be configured in Google Workspace.</small>
                  <SubmitButton>{workspace ? "Reauthorize" : "Authorize"}</SubmitButton>
                </form>
              </ActionPanel>
              <ActionPanel title="Map organizational unit">
                {workspace ? <form action={mapGoogleWorkspaceOuAction} className="stacked-form">
                  <input name="tenantId" type="hidden" value={tenant.id} />
                  <Field label="Organizational unit ID"><input name="organizationalUnitId" required /></Field>
                  <Field label="Organizational unit path"><input name="organizationalUnitPath" placeholder="/Students/Grade-7" required /></Field>
                  <SubmitButton>Save mapping</SubmitButton>
                </form> : <EmptyState title="Authorization required" body="Authorize Google Workspace before mapping organizational units." />}
              </ActionPanel>
            </div>
          ) : null}
          {workspace ? <div className="table-wrap"><table><thead><tr><th>ChromeOS device</th><th>OU</th><th>Kiosk</th><th>Managed session</th><th>Apps/extensions</th><th>Web policy</th></tr></thead><tbody>{workspace.devices.map((device) => <tr key={device.id}><td>{device.serialNumber}<small>{device.model ?? "ChromeOS"}</small></td><td>{device.organizationalUnitId}</td><td><StatusPill>{device.kioskStatus}</StatusPill></td><td><StatusPill>{device.managedSessionStatus}</StatusPill></td><td><StatusPill>{device.appExtensionStatus}</StatusPill></td><td><StatusPill>{device.webPolicyStatus}</StatusPill></td></tr>)}</tbody></table></div> : null}
        </PageSection>
        <PageSection kicker="Event delivery" title="Signed education webhooks">
          {tenant ? (
            <div className="form-grid two">
              <ActionPanel title="Configure endpoint">
                <form action={configureWebhookAction} className="stacked-form">
                  <input name="tenantId" type="hidden" value={tenant.id} />
                  <Field label="Endpoint name">
                    <input name="name" required />
                  </Field>
                  <Field label="HTTPS URL">
                    <input name="url" type="url" required />
                  </Field>
                  <Field label="Signing secret reference">
                    <input
                      name="secretReference"
                      placeholder="school/webhook-v1"
                      required
                    />
                  </Field>
                  <Field label="Maximum attempts">
                    <input
                      name="maxAttempts"
                      type="number"
                      min="1"
                      max="5"
                      defaultValue="3"
                      required
                    />
                  </Field>
                  {[
                    "device.offline",
                    "mode.changed",
                    "policy.failed",
                    "exam.started",
                    "support_ticket.created",
                    "lost_device.reported",
                  ].map((eventType) => (
                    <label key={eventType}>
                      <input
                        name="eventTypes"
                        type="checkbox"
                        value={eventType}
                      />{" "}
                      {eventType}
                    </label>
                  ))}
                  <SubmitButton>Save and enable</SubmitButton>
                  <small>
                    Secrets stay in the worker secret store. Receivers verify
                    the event ID, timestamp, and HMAC signature.
                  </small>
                </form>
              </ActionPanel>
              <ActionPanel title="Endpoints and delivery logs">
                {webhookResult.endpoints.length ? (
                  <div className="data-list">
                    {webhookResult.endpoints.map((endpoint) => (
                      <div className="data-row" key={endpoint.id}>
                        <div>
                          <strong>{endpoint.name}</strong>{" "}
                          <StatusPill
                            tone={endpoint.enabled ? "good" : "warning"}
                          >
                            {endpoint.enabled ? "ENABLED" : "DISABLED"}
                          </StatusPill>
                          <small>
                            {endpoint.url} · secret v{endpoint.secretVersion} ·{" "}
                            {endpoint.deliveries.length} recent deliveries
                          </small>
                        </div>
                        <form action={setWebhookEnabledAction}>
                          <input
                            name="tenantId"
                            type="hidden"
                            value={tenant.id}
                          />
                          <input
                            name="endpointId"
                            type="hidden"
                            value={endpoint.id}
                          />
                          <input
                            name="enabled"
                            type="hidden"
                            value={String(!endpoint.enabled)}
                          />
                          <button className="small-button">
                            {endpoint.enabled ? "Disable" : "Enable"}
                          </button>
                        </form>
                        <form
                          action={rotateWebhookSecretAction}
                          className="form-row"
                        >
                          <input
                            name="tenantId"
                            type="hidden"
                            value={tenant.id}
                          />
                          <input
                            name="endpointId"
                            type="hidden"
                            value={endpoint.id}
                          />
                          <input
                            name="secretReference"
                            placeholder="new secret reference"
                            required
                          />
                          <button className="small-button primary">
                            Rotate
                          </button>
                        </form>
                        {endpoint.deliveries.slice(0, 5).map((delivery) => (
                          <small key={delivery.id}>
                            {delivery.eventType} · {delivery.status} ·{" "}
                            {delivery.attemptCount} attempt(s)
                            {delivery.failureReason
                              ? ` · ${delivery.failureReason}`
                              : ""}
                          </small>
                        ))}
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title="No webhook endpoints"
                    body="Configure an HTTPS receiver and select the education operations it should receive."
                  />
                )}
              </ActionPanel>
            </div>
          ) : null}
        </PageSection>
        <PageSection
          kicker="Student information system"
          title="Reconciliation operations"
        >
          {tenant ? (
            <div className="form-grid two">
              <ActionPanel title="Reconcile an external ID">
                <form action={reconcileSisAction} className="stacked-form">
                  <input name="tenantId" type="hidden" value={tenant.id} />
                  <Field label="SIS source">
                    <input name="source" placeholder="POWERSCHOOL" required />
                  </Field>
                  <Field label="Object type">
                    <select name="objectType" required>
                      {[
                        "STUDENT",
                        "CLASS",
                        "TEACHER",
                        "GUARDIAN",
                        "ENROLLMENT",
                      ].map((value) => (
                        <option key={value}>{value}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Local ID">
                    <input
                      name="localId"
                      placeholder="UUID; enrollment uses classId:studentId"
                      required
                    />
                  </Field>
                  <Field label="External SIS ID">
                    <input name="externalId" required />
                  </Field>
                  <SubmitButton>Reconcile ID</SubmitButton>
                </form>
              </ActionPanel>
              <ActionPanel title="Operation history">
                <p>
                  Last successful sync:{" "}
                  {sisResult.operations?.lastSuccessAt
                    ? new Date(
                        sisResult.operations.lastSuccessAt,
                      ).toLocaleString()
                    : "None"}
                </p>
                {sisResult.operations?.runs.length ? (
                  <div className="data-list">
                    {sisResult.operations.runs.map((run) => (
                      <div className="data-row" key={run.id}>
                        <div>
                          <strong>{run.source}</strong>{" "}
                          <StatusPill>{run.status}</StatusPill>
                          <small>
                            {run.affectedRecords} affected · {run.failedRecords}{" "}
                            failed · attempt {run.attempt}
                          </small>
                        </div>
                        {run.failedRecords ? (
                          <form action={retrySisAction}>
                            <input
                              name="tenantId"
                              type="hidden"
                              value={tenant.id}
                            />
                            <input name="runId" type="hidden" value={run.id} />
                            <button className="small-button">
                              Retry failures
                            </button>
                          </form>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title="No SIS operations"
                    body="Submit a documented reconciliation request to create sync history."
                  />
                )}
              </ActionPanel>
            </div>
          ) : null}
        </PageSection>
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

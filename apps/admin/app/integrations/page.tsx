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
  retryWebhookDeliveryAction,
  setWebhookEnabledAction,
  authorizeGoogleWorkspaceAction,
  mapGoogleWorkspaceOuAction,
  configureAppleMdmAction,
  authorizeIntuneAction,
  mapIntuneGroupAction,
  createMarketplaceSubmissionAction,
  submitMarketplaceVersionAction,
  reviewMarketplaceVersionAction,
  marketplaceInstallationAction,
} from "../../lib/actions";
import {
  getAdminData,
  getClassroomIntegration,
  getLmsIntegrations,
  getEducationResources,
  getSisOperations,
  getWebhookEndpoints,
  getGoogleWorkspaceIntegration,
  getAppleMdmIntegration,
  getIntuneIntegration,
  getIntegrationMarketplace,
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
  const appleResult = tenant
    ? await getAppleMdmIntegration(tenant.id)
    : { integration: null, connectionIssue: false };
  const apple = appleResult.integration;
  const intuneResult = tenant
    ? await getIntuneIntegration(tenant.id)
    : { integration: null, connectionIssue: false };
  const intune = intuneResult.integration;
  const marketplaceResult = tenant
    ? await getIntegrationMarketplace(tenant.id)
    : { items: [], submissions: [], connectionIssue: false };
  return (
    <AppShell
      connectionIssue={
        data.connectionIssue ||
        classroomResult.connectionIssue ||
        lmsResult.connectionIssue ||
        educationResult.connectionIssue ||
        sisResult.connectionIssue ||
        webhookResult.connectionIssue ||
        workspaceResult.connectionIssue ||
        appleResult.connectionIssue ||
        intuneResult.connectionIssue ||
        marketplaceResult.connectionIssue
      }
      tenant={tenant}
    >
      <div className="content-stack">
        <PageSection kicker="Partner ecosystem" title="Integration marketplace">
          {tenant ? (
            <div className="form-grid two">
              <ActionPanel title="Submit a partner integration version">
                <form
                  action={createMarketplaceSubmissionAction}
                  className="stacked-form"
                >
                  <input name="tenantId" type="hidden" value={tenant.id} />
                  <Field label="Integration slug">
                    <input
                      name="slug"
                      placeholder="learning-library"
                      pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                      required
                    />
                  </Field>
                  <Field label="Display name">
                    <input name="name" required />
                  </Field>
                  <Field label="Category">
                    <input name="category" placeholder="Content" required />
                  </Field>
                  <Field label="Description">
                    <textarea name="description" required />
                  </Field>
                  <Field label="HTTPS test URL">
                    <input name="testUrl" type="url" required />
                  </Field>
                  <Field label="Requested scopes (comma separated)">
                    <input
                      name="scopes"
                      placeholder="roster.read, devices.read"
                      required
                    />
                  </Field>
                  <SubmitButton>Create draft version</SubmitButton>
                </form>
              </ActionPanel>
              <ActionPanel title="Published catalog">
                {marketplaceResult.items.length ? (
                  <div className="data-list">
                    {marketplaceResult.items.map((item) => (
                      <div className="data-row" key={item.id}>
                        <strong>
                          {item.name} v{item.version}
                        </strong>
                        <StatusPill
                          tone={
                            item.installation?.status === "ENABLED"
                              ? "good"
                              : undefined
                          }
                        >
                          {item.installation?.status ?? "AVAILABLE"}
                        </StatusPill>
                        <small>
                          {item.category} · {item.description}
                        </small>
                        <form action={marketplaceInstallationAction}>
                          <input
                            name="tenantId"
                            type="hidden"
                            value={tenant.id}
                          />
                          <input
                            name="submissionId"
                            type="hidden"
                            value={item.id}
                          />
                          <button
                            name="marketplaceAction"
                            value={
                              item.installation?.status === "ENABLED"
                                ? "test"
                                : "enable"
                            }
                          >
                            {item.installation?.status === "ENABLED"
                              ? "Test"
                              : "Enable"}
                          </button>
                          {item.installation?.status === "ENABLED" ? (
                            <button name="marketplaceAction" value="disable">
                              Disable
                            </button>
                          ) : null}
                        </form>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title="No published integrations"
                    body="Approved partner versions appear here after publication."
                  />
                )}
              </ActionPanel>
            </div>
          ) : null}
          {tenant && marketplaceResult.submissions.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Submission</th>
                    <th>Status</th>
                    <th>Review workflow</th>
                  </tr>
                </thead>
                <tbody>
                  {marketplaceResult.submissions.map((item) => (
                    <tr key={item.id}>
                      <td>
                        {item.name} v{item.version}
                        <small>{item.slug}</small>
                      </td>
                      <td>
                        <StatusPill>{item.status}</StatusPill>
                        {item.reviewNotes ? (
                          <small>{item.reviewNotes}</small>
                        ) : null}
                      </td>
                      <td>
                        {item.status === "DRAFT" ? (
                          <form action={submitMarketplaceVersionAction}>
                            <input
                              name="tenantId"
                              type="hidden"
                              value={tenant.id}
                            />
                            <input
                              name="submissionId"
                              type="hidden"
                              value={item.id}
                            />
                            <SubmitButton>Submit</SubmitButton>
                          </form>
                        ) : null}
                        {["SUBMITTED", "IN_REVIEW", "APPROVED"].includes(
                          item.status,
                        ) ? (
                          <form
                            action={reviewMarketplaceVersionAction}
                            className="stacked-form"
                          >
                            <input
                              name="tenantId"
                              type="hidden"
                              value={tenant.id}
                            />
                            <input
                              name="submissionId"
                              type="hidden"
                              value={item.id}
                            />
                            {item.status === "IN_REVIEW" ? (
                              <Field label="Decision notes">
                                <input name="notes" />
                              </Field>
                            ) : null}
                            <select
                              name="status"
                              defaultValue={
                                item.status === "SUBMITTED"
                                  ? "IN_REVIEW"
                                  : item.status === "APPROVED"
                                    ? "PUBLISHED"
                                    : "APPROVED"
                              }
                            >
                              {item.status === "SUBMITTED" ? (
                                <option>IN_REVIEW</option>
                              ) : null}
                              {item.status === "IN_REVIEW" ? (
                                <>
                                  <option>APPROVED</option>
                                  <option>REJECTED</option>
                                </>
                              ) : null}
                              {item.status === "APPROVED" ? (
                                <option>PUBLISHED</option>
                              ) : null}
                            </select>
                            <SubmitButton>Apply review</SubmitButton>
                          </form>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </PageSection>
        <PageSection
          kicker="Windows management"
          title="Microsoft Intune for Education"
        >
          {tenant ? (
            <div className="form-grid two">
              <ActionPanel title="Guided authorization">
                <form action={authorizeIntuneAction} className="stacked-form">
                  <input name="tenantId" type="hidden" value={tenant.id} />
                  <Field label="Microsoft Entra tenant ID">
                    <input
                      name="entraTenantId"
                      defaultValue={intune?.entraTenantId}
                      placeholder="00000000-0000-0000-0000-000000000000"
                      required
                    />
                  </Field>
                  <Field label="Application client ID">
                    <input
                      name="clientId"
                      defaultValue={intune?.clientId}
                      placeholder="00000000-0000-0000-0000-000000000000"
                      required
                    />
                  </Field>
                  <Field label="Client credential secret reference">
                    <input
                      name="credentialReference"
                      defaultValue={intune?.credentialReference}
                      placeholder="secret://microsoft-intune"
                      required
                    />
                  </Field>
                  <small>
                    Grant the application least-privilege Microsoft Graph
                    device-management read access. Only an external secret or
                    certificate reference is stored.
                  </small>
                  <SubmitButton>
                    {intune ? "Reauthorize" : "Authorize"}
                  </SubmitButton>
                </form>
              </ActionPanel>
              <ActionPanel title="Map Microsoft Entra group">
                {intune ? (
                  <form action={mapIntuneGroupAction} className="stacked-form">
                    <input name="tenantId" type="hidden" value={tenant.id} />
                    <Field label="Group object ID">
                      <input name="groupId" required />
                    </Field>
                    <Field label="Group name">
                      <input
                        name="groupName"
                        placeholder="Grade 7 managed devices"
                        required
                      />
                    </Field>
                    <small>
                      Only devices in enabled mappings are accepted during
                      inventory sync.
                    </small>
                    <SubmitButton>Save mapping</SubmitButton>
                  </form>
                ) : (
                  <EmptyState
                    title="Authorization required"
                    body="Authorize Microsoft Intune before mapping device groups."
                  />
                )}
              </ActionPanel>
            </div>
          ) : null}
          {intune ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Windows device</th>
                    <th>Group</th>
                    <th>Health</th>
                    <th>Kiosk</th>
                    <th>Assessment</th>
                    <th>Autopilot</th>
                    <th>Applications</th>
                  </tr>
                </thead>
                <tbody>
                  {intune.devices.map((device) => (
                    <tr key={device.id}>
                      <td>
                        {device.serialNumber}
                        <small>
                          {device.model ?? "Windows device"} · Windows{" "}
                          {device.osVersion ?? "unknown"}
                        </small>
                      </td>
                      <td>
                        {intune.groups.find(
                          (group) => group.groupId === device.groupId,
                        )?.groupName ?? device.groupId}
                      </td>
                      <td>
                        <StatusPill>{device.managementHealthStatus}</StatusPill>
                      </td>
                      <td>
                        <StatusPill>{device.kioskStatus}</StatusPill>
                      </td>
                      <td>
                        <StatusPill>{device.assessmentStatus}</StatusPill>
                      </td>
                      <td>
                        <StatusPill>{device.autopilotStatus}</StatusPill>
                      </td>
                      <td>
                        <StatusPill>{device.appDeploymentStatus}</StatusPill>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </PageSection>
        <PageSection
          kicker="iPadOS management"
          title="Apple School Manager and external MDM"
        >
          {tenant ? (
            <div className="form-grid two">
              <ActionPanel title="Guided token and certificate setup">
                <form action={configureAppleMdmAction} className="stacked-form">
                  <input name="tenantId" type="hidden" value={tenant.id} />
                  <Field label="External MDM provider">
                    <input
                      name="providerName"
                      defaultValue={apple?.providerName}
                      required
                    />
                  </Field>
                  <Field label="MDM server URL">
                    <input
                      name="serverUrl"
                      type="url"
                      defaultValue={apple?.serverUrl}
                      required
                    />
                  </Field>
                  <Field label="Apple School Manager organization ID">
                    <input
                      name="appleSchoolManagerId"
                      defaultValue={apple?.appleSchoolManagerId}
                      required
                    />
                  </Field>
                  <Field label="Token and certificate secret reference">
                    <input
                      name="credentialReference"
                      defaultValue={apple?.credentialReference}
                      placeholder="secret://apple-mdm"
                      required
                    />
                  </Field>
                  <Field label="ASM token expiry">
                    <input
                      name="tokenExpiresAt"
                      type="datetime-local"
                      required
                    />
                  </Field>
                  <Field label="MDM certificate expiry">
                    <input
                      name="certificateExpiresAt"
                      type="datetime-local"
                      required
                    />
                  </Field>
                  <small>
                    Upload tokens and certificates to the deployment secret
                    manager. This workflow stores only the external reference
                    and expiry metadata.
                  </small>
                  <SubmitButton>
                    {apple ? "Renew setup" : "Configure"}
                  </SubmitButton>
                </form>
              </ActionPanel>
              <ActionPanel title="Connection readiness">
                {apple ? (
                  <div className="data-list">
                    <div className="data-row">
                      <strong>{apple.providerName}</strong>
                      <StatusPill tone="good">{apple.status}</StatusPill>
                      <small>
                        ASM organization: {apple.appleSchoolManagerId}
                      </small>
                    </div>
                    <div className="data-row">
                      <strong>ADE token</strong>
                      <StatusPill
                        tone={apple.tokenExpiryAlert ? "warning" : "good"}
                      >
                        {apple.tokenExpiryAlert ? "RENEW SOON" : "CURRENT"}
                      </StatusPill>
                      <small>
                        Expires{" "}
                        {new Date(apple.tokenExpiresAt).toLocaleString()}
                      </small>
                    </div>
                    <div className="data-row">
                      <strong>MDM certificate</strong>
                      <StatusPill
                        tone={apple.certificateExpiryAlert ? "warning" : "good"}
                      >
                        {apple.certificateExpiryAlert
                          ? "RENEW SOON"
                          : "CURRENT"}
                      </StatusPill>
                      <small>
                        Expires{" "}
                        {new Date(apple.certificateExpiresAt).toLocaleString()}
                      </small>
                    </div>
                  </div>
                ) : (
                  <EmptyState
                    title="Setup required"
                    body="Connect an external iPadOS MDM and record Apple School Manager token and certificate expiry dates."
                  />
                )}
              </ActionPanel>
            </div>
          ) : null}
          {apple ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>iPadOS device</th>
                    <th>ADE</th>
                    <th>Supervision</th>
                    <th>Restrictions</th>
                    <th>Apps / books</th>
                    <th>Managed configuration</th>
                  </tr>
                </thead>
                <tbody>
                  {apple.devices.map((device) => (
                    <tr key={device.id}>
                      <td>
                        {device.serialNumber}
                        <small>
                          {device.model ?? "iPad"} · iPadOS{" "}
                          {device.osVersion ?? "unknown"}
                        </small>
                      </td>
                      <td>
                        <StatusPill>{device.adeStatus}</StatusPill>
                      </td>
                      <td>
                        <StatusPill>{device.supervisionStatus}</StatusPill>
                      </td>
                      <td>
                        <StatusPill>{device.restrictionStatus}</StatusPill>
                      </td>
                      <td>
                        <StatusPill>{device.appBookStatus}</StatusPill>
                      </td>
                      <td>
                        <StatusPill>
                          {device.managedConfigurationStatus}
                        </StatusPill>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </PageSection>
        <PageSection kicker="ChromeOS management" title="Google Workspace">
          {tenant ? (
            <div className="form-grid two">
              <ActionPanel title="Guided authorization">
                <form
                  action={authorizeGoogleWorkspaceAction}
                  className="stacked-form"
                >
                  <input name="tenantId" type="hidden" value={tenant.id} />
                  <Field label="Google customer ID">
                    <input
                      defaultValue={workspace?.customerId}
                      name="customerId"
                      required
                    />
                  </Field>
                  <Field label="Delegated admin email">
                    <input
                      defaultValue={workspace?.delegatedAdminEmail}
                      name="delegatedAdminEmail"
                      type="email"
                      required
                    />
                  </Field>
                  <Field label="Service-account secret reference">
                    <input
                      defaultValue={workspace?.credentialReference}
                      name="credentialReference"
                      placeholder="secret://google-workspace"
                      required
                    />
                  </Field>
                  <small>
                    Only an external secret reference is stored. Domain-wide
                    delegation must be configured in Google Workspace.
                  </small>
                  <SubmitButton>
                    {workspace ? "Reauthorize" : "Authorize"}
                  </SubmitButton>
                </form>
              </ActionPanel>
              <ActionPanel title="Map organizational unit">
                {workspace ? (
                  <form
                    action={mapGoogleWorkspaceOuAction}
                    className="stacked-form"
                  >
                    <input name="tenantId" type="hidden" value={tenant.id} />
                    <Field label="Organizational unit ID">
                      <input name="organizationalUnitId" required />
                    </Field>
                    <Field label="Organizational unit path">
                      <input
                        name="organizationalUnitPath"
                        placeholder="/Students/Grade-7"
                        required
                      />
                    </Field>
                    <SubmitButton>Save mapping</SubmitButton>
                  </form>
                ) : (
                  <EmptyState
                    title="Authorization required"
                    body="Authorize Google Workspace before mapping organizational units."
                  />
                )}
              </ActionPanel>
            </div>
          ) : null}
          {workspace ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>ChromeOS device</th>
                    <th>OU</th>
                    <th>Kiosk</th>
                    <th>Managed session</th>
                    <th>Apps/extensions</th>
                    <th>Web policy</th>
                  </tr>
                </thead>
                <tbody>
                  {workspace.devices.map((device) => (
                    <tr key={device.id}>
                      <td>
                        {device.serialNumber}
                        <small>{device.model ?? "ChromeOS"}</small>
                      </td>
                      <td>{device.organizationalUnitId}</td>
                      <td>
                        <StatusPill>{device.kioskStatus}</StatusPill>
                      </td>
                      <td>
                        <StatusPill>{device.managedSessionStatus}</StatusPill>
                      </td>
                      <td>
                        <StatusPill>{device.appExtensionStatus}</StatusPill>
                      </td>
                      <td>
                        <StatusPill>{device.webPolicyStatus}</StatusPill>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
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
                          <div key={delivery.id}>
                            <small>
                              {delivery.eventType} · {delivery.status} ·{" "}
                              {delivery.attemptCount} attempt(s) · event{" "}
                              {delivery.eventId}
                              {delivery.responseStatus
                                ? ` · HTTP ${delivery.responseStatus}`
                                : ""}
                              {delivery.failureReason
                                ? ` · ${delivery.failureReason}`
                                : ""}
                            </small>
                            {delivery.status === "FAILED" &&
                            endpoint.enabled ? (
                              <form
                                action={retryWebhookDeliveryAction}
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
                                  name="deliveryId"
                                  type="hidden"
                                  value={delivery.id}
                                />
                                <input
                                  aria-label={`Retry reason for ${delivery.eventId}`}
                                  name="reason"
                                  minLength={3}
                                  placeholder="Reason for redelivery"
                                  required
                                />
                                <button className="small-button">
                                  Retry failed delivery
                                </button>
                              </form>
                            ) : null}
                          </div>
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

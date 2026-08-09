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
  acceptPrivacyNoticeAction,
  createComplianceEvidencePackAction,
  createDataSubjectRequestAction,
  decideDataSubjectRequestAction,
  publishPrivacyNoticeAction,
  revokePrivacyAcceptanceAction,
  updateSecurityPrivacyProfileAction,
} from "../../lib/actions";
import { getAdminData } from "../../lib/api";
import { roleCan } from "../../lib/auth/portal-access";

export const dynamic = "force-dynamic";

export default async function PrivacyPage() {
  const data = await getAdminData("/privacy");
  const tenant = data.selectedTenant;
  const overview = data.securityPrivacyOverview;
  const canManage = roleCan(data.session.role, "tenant:update");
  return (
    <AppShell connectionIssue={data.connectionIssue} tenant={tenant}>
      <div className="content-stack">
        <PageSection
          kicker="Enterprise governance"
          title="Security and privacy center"
        >
          {tenant && overview ? (
            <>
              <div className="metric-grid">
                <div className="metric-card">
                  <span>Data region</span>
                  <strong>{overview.dataSettings.dataRegion}</strong>
                  <small>
                    {overview.dataSettings.allowedRegionCodes.join(", ") ||
                      "Tenant region only"}
                  </small>
                </div>
                <div className="metric-card">
                  <span>Active staff</span>
                  <strong>{overview.accessControls.activeUsers}</strong>
                  <small>
                    {overview.accessControls.suspendedUsers} suspended
                  </small>
                </div>
                <div className="metric-card">
                  <span>Access governance</span>
                  <strong>
                    {overview.accessControls.activeDelegatedAssignments}
                  </strong>
                  <small>
                    {overview.accessControls.openAccessReviews} open reviews
                  </small>
                </div>
                <div className="metric-card">
                  <span>Privileged MFA</span>
                  <strong>
                    {overview.accessControls.mfaEnforcedForPrivilegedAccess
                      ? "Enforced"
                      : "Action needed"}
                  </strong>
                  <small>
                    {overview.privacyNoticeCount} policy notice versions
                  </small>
                </div>
              </div>
              <div className="form-grid">
                <ActionPanel title="Incident and child-safety governance">
                  {canManage ? (
                    <form
                      action={updateSecurityPrivacyProfileAction}
                      className="stacked-form"
                    >
                      <input name="tenantId" type="hidden" value={tenant.id} />
                      <div className="form-row">
                        <Field label="Incident contact">
                          <input
                            name="incidentContactName"
                            required
                            defaultValue={
                              overview.profile.incidentContact?.name ?? ""
                            }
                          />
                        </Field>
                        <Field label="Contact email">
                          <input
                            name="incidentContactEmail"
                            type="email"
                            required
                            defaultValue={
                              overview.profile.incidentContact?.email ?? ""
                            }
                          />
                        </Field>
                      </div>
                      <Field label="Contact phone">
                        <input
                          name="incidentContactPhone"
                          defaultValue={
                            overview.profile.incidentContact?.phone ?? ""
                          }
                        />
                      </Field>
                      <Field label="Policy documents (one Title | https://URL per line)">
                        <textarea
                          name="policyDocuments"
                          rows={4}
                          defaultValue={overview.profile.policyDocuments
                            .map((item) => `${item.title} | ${item.url}`)
                            .join("\n")}
                        />
                      </Field>
                      <Field label="Child-safety guardrails (one per line)">
                        <textarea
                          name="childSafetyGuardrails"
                          required
                          rows={5}
                          defaultValue={overview.profile.childSafetyGuardrails.join(
                            "\n",
                          )}
                        />
                      </Field>
                      <SubmitButton>Save governance profile</SubmitButton>
                    </form>
                  ) : (
                    <div className="list-panel">
                      <div className="list-row">
                        <div>
                          <strong>
                            {overview.profile.incidentContact?.name ??
                              "Incident contact not configured"}
                          </strong>
                          <span>
                            {overview.profile.incidentContact?.email ??
                              "Ask a tenant administrator to configure the contact."}
                          </span>
                        </div>
                      </div>
                      {overview.profile.childSafetyGuardrails.map((item) => (
                        <div className="list-row" key={item}>
                          <div>
                            <strong>Child-safety guardrail</strong>
                            <span>{item}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ActionPanel>
                <ActionPanel title="Retention and audit evidence">
                  <div className="list-panel">
                    <div className="list-row">
                      <div>
                        <strong>Audit retention</strong>
                        <span>
                          {overview.retention?.auditRetentionDays
                            ? `${overview.retention.auditRetentionDays} days`
                            : "Indefinite"}
                        </span>
                      </div>
                    </div>
                    <div className="list-row">
                      <div>
                        <strong>Diagnostics retention</strong>
                        <span>
                          {overview.retention?.diagnosticRetentionDays ??
                            "Default"}{" "}
                          days
                        </span>
                      </div>
                    </div>
                    <div className="list-row">
                      <div>
                        <strong>Tenant-scoped audit export</strong>
                        <span>{overview.auditExportPath}</span>
                      </div>
                    </div>
                  </div>
                </ActionPanel>
              </div>
            </>
          ) : (
            <EmptyState
              title="Security center unavailable"
              body="The consolidated governance view requires privacy-officer access."
            />
          )}
        </PageSection>
        <PageSection kicker="Compliance" title="Immutable evidence packs">
          {tenant && overview ? (
            <div className="form-grid">
              <ActionPanel title="Generate a time-bounded pack">
                <form
                  action={createComplianceEvidencePackAction}
                  className="stacked-form"
                >
                  <input name="tenantId" type="hidden" value={tenant.id} />
                  <Field label="Pack name">
                    <input
                      name="name"
                      required
                      placeholder="Annual access controls review"
                    />
                  </Field>
                  <div className="form-row">
                    <Field label="Window start">
                      <input name="windowFrom" type="datetime-local" required />
                    </Field>
                    <Field label="Window end">
                      <input name="windowTo" type="datetime-local" required />
                    </Field>
                  </div>
                  <Field label="Evidence sections">
                    <div className="checkbox-list">
                      {[
                        ["AUDIT_LOGS", "Audit logs"],
                        ["ACCESS_REVIEWS", "Access reviews"],
                        ["RETENTION", "Retention settings"],
                        ["CONTROLS", "Controls summary"],
                        ["POLICIES", "Policy exports"],
                      ].map(([value, label]) => (
                        <label key={value}>
                          <input
                            name="sections"
                            type="checkbox"
                            value={value}
                          />{" "}
                          {label}
                        </label>
                      ))}
                    </div>
                  </Field>
                  <SubmitButton>Generate evidence pack</SubmitButton>
                  <small>
                    Windows are limited to 366 days. Generated snapshots cannot
                    be edited or replaced.
                  </small>
                </form>
              </ActionPanel>
              <ActionPanel title="Generated packs">
                {data.complianceEvidencePacks.length ? (
                  <div className="list-panel">
                    {data.complianceEvidencePacks.map((pack) => (
                      <div className="list-row" key={pack.id}>
                        <div>
                          <strong>{pack.name}</strong>
                          <span>
                            {new Date(pack.windowFrom).toLocaleDateString()} –{" "}
                            {new Date(pack.windowTo).toLocaleDateString()} ·{" "}
                            {pack.sections.join(", ")}
                          </span>
                          <small>SHA-256 {pack.checksum}</small>
                        </div>
                        <a
                          className="small-button primary"
                          href={`/privacy/evidence-pack.json?tenantId=${encodeURIComponent(tenant.id)}&packId=${encodeURIComponent(pack.id)}`}
                        >
                          Download JSON
                        </a>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title="No evidence packs"
                    body="Generate a bounded snapshot for an audit or customer evidence request."
                  />
                )}
              </ActionPanel>
            </div>
          ) : null}
        </PageSection>
        <PageSection kicker="Privacy operations" title="Data-subject requests">
          {tenant && overview ? (
            <div className="form-grid">
              <ActionPanel title="Open a governed request">
                <form
                  action={createDataSubjectRequestAction}
                  className="stacked-form"
                >
                  <input name="tenantId" type="hidden" value={tenant.id} />
                  <div className="form-row">
                    <Field label="Operation">
                      <select name="requestType">
                        <option>EXPORT</option>
                        <option>DELETE</option>
                      </select>
                    </Field>
                    <Field label="Subject type">
                      <select name="subjectType">
                        <option>STUDENT</option>
                        <option>GUARDIAN</option>
                        <option>USER</option>
                      </select>
                    </Field>
                  </div>
                  <Field label="Tenant record ID">
                    <input name="subjectId" required />
                  </Field>
                  <Field label="Reason and identity-verification evidence">
                    <textarea name="reason" minLength={10} required rows={3} />
                  </Field>
                  <Field label="Retention obligation ends (optional)">
                    <input name="retentionUntil" type="datetime-local" />
                  </Field>
                  <SubmitButton>Submit for independent approval</SubmitButton>
                </form>
              </ActionPanel>
              <ActionPanel title="Request queue">
                {data.dataSubjectRequests.length ? (
                  <div className="list-panel">
                    {data.dataSubjectRequests.map((request) => (
                      <div className="list-row" key={request.id}>
                        <div>
                          <strong>
                            {request.requestType} {request.subjectType}
                          </strong>
                          <span>
                            {request.subjectId} · {request.status}
                          </span>
                          <small>{request.reason}</small>
                        </div>
                        {request.status === "PENDING" && canManage ? (
                          <form
                            action={decideDataSubjectRequestAction}
                            className="row-form"
                          >
                            <input
                              name="tenantId"
                              type="hidden"
                              value={tenant.id}
                            />
                            <input
                              name="requestId"
                              type="hidden"
                              value={request.id}
                            />
                            <input
                              name="reason"
                              minLength={5}
                              placeholder="Independent decision reason"
                              required
                            />
                            <button
                              className="small-button primary"
                              name="decision"
                              value="APPROVE"
                            >
                              Approve
                            </button>
                            <button
                              className="small-button danger"
                              name="decision"
                              value="REJECT"
                            >
                              Reject
                            </button>
                          </form>
                        ) : request.downloadPath ? (
                          <a
                            className="small-button primary"
                            href={`/privacy/data-subject-export.json?tenantId=${encodeURIComponent(tenant.id)}&requestId=${encodeURIComponent(request.id)}`}
                          >
                            Download export
                          </a>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title="No requests"
                    body="Verified export and deletion requests will appear here."
                  />
                )}
              </ActionPanel>
            </div>
          ) : null}
        </PageSection>
        <PageSection kicker="Governance" title="Privacy notices and consent">
          {tenant && canManage ? (
            <div className="form-grid">
              <ActionPanel title="Publish a new immutable version">
                <form
                  action={publishPrivacyNoticeAction}
                  className="stacked-form"
                >
                  <input name="tenantId" type="hidden" value={tenant.id} />
                  <div className="form-row">
                    <Field label="Notice type">
                      <input
                        name="noticeType"
                        placeholder="GENERAL_PRIVACY"
                        required
                      />
                    </Field>
                    <Field label="Channel">
                      <select name="channel">
                        <option>WEB</option>
                        <option>MOBILE</option>
                        <option>EMAIL</option>
                      </select>
                    </Field>
                  </div>
                  <Field label="Title">
                    <input name="title" required />
                  </Field>
                  <Field label="Notice content">
                    <textarea name="content" required rows={8} />
                  </Field>
                  <SubmitButton>Publish notice</SubmitButton>
                </form>
              </ActionPanel>
            </div>
          ) : null}
        </PageSection>
        <PageSection title="Published versions">
          {tenant && data.privacyNotices.length ? (
            <div className="list-panel">
              {data.privacyNotices.map((notice) => (
                <article className="list-row" key={notice.id}>
                  <div>
                    <strong>{notice.title}</strong>
                    <span>
                      {notice.noticeType} · {notice.channel} · version{" "}
                      {notice.version}
                    </span>
                    <small>{notice.content}</small>
                  </div>
                  <form
                    action={acceptPrivacyNoticeAction}
                    className="button-form"
                  >
                    <input name="tenantId" type="hidden" value={tenant.id} />
                    <input name="noticeId" type="hidden" value={notice.id} />
                    <input
                      name="channel"
                      type="hidden"
                      value={notice.channel}
                    />
                    <button className="small-button primary">
                      Accept this version
                    </button>
                  </form>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No privacy notices"
              body="Publish the first channel-specific notice to begin collecting versioned acceptance."
            />
          )}
        </PageSection>
        <PageSection title="Acceptance records">
          {tenant && data.privacyAcceptances.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Subject</th>
                    <th>Channel</th>
                    <th>Accepted</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {data.privacyAcceptances.map((item) => (
                    <tr key={item.id}>
                      <td>
                        {item.subjectType}: {item.subjectId}
                      </td>
                      <td>{item.channel}</td>
                      <td>{new Date(item.acceptedAt).toLocaleString()}</td>
                      <td>
                        <StatusPill tone={item.revokedAt ? "warning" : "good"}>
                          {item.revokedAt ? "Revoked" : "Active"}
                        </StatusPill>
                      </td>
                      <td>
                        {!item.revokedAt ? (
                          <form
                            action={revokePrivacyAcceptanceAction}
                            className="row-form"
                          >
                            <input
                              name="tenantId"
                              type="hidden"
                              value={tenant.id}
                            />
                            <input
                              name="acceptanceId"
                              type="hidden"
                              value={item.id}
                            />
                            <input
                              name="reason"
                              placeholder="Revocation reason"
                              required
                            />
                            <button className="small-button danger">
                              Revoke mine
                            </button>
                          </form>
                        ) : (
                          item.revokeReason
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title="No acceptance records"
              body="Acceptance and revocation history will appear here."
            />
          )}
        </PageSection>
      </div>
    </AppShell>
  );
}

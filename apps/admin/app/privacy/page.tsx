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
  publishPrivacyNoticeAction,
  revokePrivacyAcceptanceAction,
} from "../../lib/actions";
import { getAdminData } from "../../lib/api";

export const dynamic = "force-dynamic";

export default async function PrivacyPage() {
  const data = await getAdminData("/privacy");
  const tenant = data.selectedTenant;
  return (
    <AppShell connectionIssue={data.connectionIssue} tenant={tenant}>
      <div className="content-stack">
        <PageSection kicker="Governance" title="Privacy notices and consent">
          {tenant ? (
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

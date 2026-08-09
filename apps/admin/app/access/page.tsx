import { permissions } from "@virtual-school/shared";
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
  assignAccessRoleAction,
  createAccessReviewAction,
  createAccessRoleTemplateAction,
  decideAccessReviewAction,
} from "../../lib/actions";
import { getAccessGovernance, getAdminData } from "../../lib/api";

export const dynamic = "force-dynamic";
export default async function AccessPage() {
  const base = await getAdminData("/access");
  const tenant = base.selectedTenant;
  const result = tenant
    ? await getAccessGovernance(tenant.id)
    : { data: null, connectionIssue: false };
  const data = result.data;
  return (
    <AppShell
      tenant={tenant}
      connectionIssue={base.connectionIssue || result.connectionIssue}
    >
      <div className="content-stack">
        <PageSection kicker="Least privilege" title="Delegated administration">
          <p>
            Custom permissions are bounded to this tenant and optionally to one
            branch or named regions. Assignment and revocation force a fresh
            sign-in.
          </p>
          {tenant ? (
            <div className="form-grid two">
              <ActionPanel title="Create permission template">
                <form
                  action={createAccessRoleTemplateAction}
                  className="stacked-form"
                >
                  <input type="hidden" name="tenantId" value={tenant.id} />
                  <Field label="Template name">
                    <input name="name" required />
                  </Field>
                  <Field label="Description">
                    <input name="description" />
                  </Field>
                  <div className="checkbox-grid">
                    {permissions
                      .filter((p) => p !== "tenant:create")
                      .map((p) => (
                        <label key={p}>
                          <input type="checkbox" name="permissions" value={p} />
                          {p}
                        </label>
                      ))}
                  </div>
                  <SubmitButton>Create template</SubmitButton>
                </form>
              </ActionPanel>
              <ActionPanel title="Assign bounded role">
                <form action={assignAccessRoleAction} className="stacked-form">
                  <input type="hidden" name="tenantId" value={tenant.id} />
                  <Field label="Staff user">
                    <select name="userId" required>
                      <option value="">Select user</option>
                      {base.users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name} · {u.email}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Role template">
                    <select name="templateId" required>
                      <option value="">Select template</option>
                      {data?.templates
                        .filter((t) => t.active)
                        .map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                    </select>
                  </Field>
                  <Field label="Scope">
                    <select name="scopeType">
                      <option value="BRANCH">One branch</option>
                      <option value="REGION">Named regions</option>
                      <option value="TENANT">Whole tenant</option>
                    </select>
                  </Field>
                  <Field label="Branch ID (branch scope)">
                    <input name="branchId" />
                  </Field>
                  <Field label="Region codes, comma-separated">
                    <input name="regionCodes" placeholder="NORTH, CENTRAL" />
                  </Field>
                  <Field label="Optional expiry">
                    <input name="expiresAt" type="datetime-local" />
                  </Field>
                  <SubmitButton>Assign and force re-login</SubmitButton>
                </form>
              </ActionPanel>
            </div>
          ) : null}
        </PageSection>
        <PageSection title="Current delegated access">
          {data?.assignments.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Template</th>
                    <th>Scope</th>
                    <th>Permissions</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.assignments.map((a) => (
                    <tr key={a.id}>
                      <td>
                        {a.userName}
                        <small>{a.userEmail}</small>
                      </td>
                      <td>{a.templateName}</td>
                      <td>
                        {a.scopeType === "BRANCH"
                          ? a.branchId
                          : a.scopeType === "REGION"
                            ? a.regionCodes.join(", ")
                            : "Tenant"}
                      </td>
                      <td>{a.permissions.join(", ")}</td>
                      <td>
                        <StatusPill tone={a.revokedAt ? "warning" : "good"}>
                          {a.revokedAt ? "REVOKED" : "ACTIVE"}
                        </StatusPill>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title="No delegated assignments"
              body="Create a template and assign it to an active staff user."
            />
          )}
        </PageSection>
        <PageSection
          kicker="Periodic evidence"
          title="Privileged-access reviews"
        >
          {tenant ? (
            <ActionPanel title="Start review">
              <form action={createAccessReviewAction} className="form-row">
                <input type="hidden" name="tenantId" value={tenant.id} />
                <input
                  name="name"
                  placeholder="Quarterly privileged access"
                  required
                />
                <input name="dueAt" type="datetime-local" required />
                <SubmitButton>Snapshot active access</SubmitButton>
              </form>
            </ActionPanel>
          ) : null}
          {data?.reviews.map((review) => (
            <ActionPanel
              key={review.id}
              title={`${review.name} · ${review.status}`}
            >
              <a
                className="small-button"
                href={`/access/review-export.csv?tenantId=${encodeURIComponent(tenant!.id)}&reviewId=${encodeURIComponent(review.id)}`}
              >
                Export CSV evidence
              </a>
              {review.items.map((item) => (
                <div className="list-row" key={item.id}>
                  <div>
                    <strong>{item.userName}</strong>
                    <small>
                      {item.templateName} · {item.scope}
                    </small>
                    <StatusPill>{item.decision}</StatusPill>
                  </div>
                  {item.decision === "PENDING" ? (
                    <form
                      action={decideAccessReviewAction}
                      className="form-row"
                    >
                      <input type="hidden" name="tenantId" value={tenant!.id} />
                      <input type="hidden" name="reviewId" value={review.id} />
                      <input type="hidden" name="itemId" value={item.id} />
                      <input
                        name="reason"
                        placeholder="Evidence / reason"
                        required
                      />
                      <button
                        name="decision"
                        value="CONFIRMED"
                        className="small-button primary"
                      >
                        Confirm
                      </button>
                      <button
                        name="decision"
                        value="REVOKED"
                        className="small-button"
                      >
                        Revoke
                      </button>
                    </form>
                  ) : null}
                </div>
              ))}
            </ActionPanel>
          ))}
        </PageSection>
      </div>
    </AppShell>
  );
}

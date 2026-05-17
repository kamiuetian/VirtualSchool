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
  createBranchAction,
  createTenantAction,
  deactivateStaffAction,
  forceLogoutStaffAction,
  inviteStaffAction,
  reactivateStaffAction,
  setStaffMfaAction,
  suspendStaffAction,
  updateStaffRoleAction,
} from "../../lib/actions";
import { getAdminData } from "../../lib/api";
import { formatCount, humanize } from "../../lib/format";

export const dynamic = "force-dynamic";

export default async function TenantsPage() {
  const data = await getAdminData();
  const selectedTenant = data.selectedTenant;

  return (
    <AppShell connectionIssue={data.connectionIssue} tenant={selectedTenant}>
      <div className="content-stack">
        <PageSection kicker="Schools" title="Tenant Directory">
          <section className="stat-grid" aria-label="School tenant summary">
            <StatCard label="Schools" value={formatCount(data.tenants.length)} />
            <StatCard
              label="Active"
              tone="good"
              value={formatCount(data.tenants.filter((tenant) => tenant.status === "ACTIVE").length)}
            />
            <StatCard
              label="Pilot"
              value={formatCount(data.tenants.filter((tenant) => tenant.status === "PILOT").length)}
            />
            <StatCard label="Plans" value={formatCount(new Set(data.tenants.map((tenant) => tenant.planKey)).size)} />
          </section>
        </PageSection>

        <PageSection kicker="Setup" title="School Administration">
          <div className="form-grid">
            <ActionPanel title="Create school">
              <form action={createTenantAction} className="stacked-form">
                <Field label="School name">
                  <input name="name" placeholder="Northview Primary School" required />
                </Field>
                <div className="form-row">
                  <Field label="Country">
                    <input name="country" placeholder="US" required />
                  </Field>
                  <Field label="Timezone">
                    <input name="timezone" placeholder="America/New_York" required />
                  </Field>
                </div>
                <div className="form-row">
                  <Field label="Plan">
                    <select name="planKey" defaultValue="pilot">
                      <option value="pilot">Pilot</option>
                      <option value="starter">Starter</option>
                      <option value="growth">Growth</option>
                      <option value="enterprise">Enterprise</option>
                    </select>
                  </Field>
                  <Field label="Status">
                    <select name="status" defaultValue="PILOT">
                      <option value="PILOT">Pilot</option>
                      <option value="ACTIVE">Active</option>
                    </select>
                  </Field>
                </div>
                <Field label="Billing contact">
                  <input name="primaryContactEmail" placeholder="admin@school.edu" type="email" />
                </Field>
                <SubmitButton>Create school</SubmitButton>
              </form>
            </ActionPanel>

            {selectedTenant ? (
              <>
                <ActionPanel title="Add campus">
                  <form action={createBranchAction} className="stacked-form">
                    <input name="tenantId" type="hidden" value={selectedTenant.id} />
                    <Field label="Campus name">
                      <input name="name" placeholder="Main Campus" required />
                    </Field>
                    <Field label="Timezone">
                      <input
                        name="timezone"
                        placeholder={selectedTenant.timezone}
                      />
                    </Field>
                    <SubmitButton>Add campus</SubmitButton>
                  </form>
                </ActionPanel>

                <ActionPanel title="Invite staff">
                  <form action={inviteStaffAction} className="stacked-form">
                    <input name="tenantId" type="hidden" value={selectedTenant.id} />
                    <Field label="Name">
                      <input name="name" placeholder="Aisha Khan" required />
                    </Field>
                    <Field label="Email">
                      <input name="email" placeholder="staff@school.edu" required type="email" />
                    </Field>
                    <Field label="Role">
                      <select name="role" defaultValue="TEACHER">
                        <option value="SCHOOL_ADMIN">School admin</option>
                        <option value="IT_ADMIN">IT admin</option>
                        <option value="ACADEMIC_ADMIN">Academic admin</option>
                        <option value="TEACHER">Teacher</option>
                        <option value="SUPPORT_AGENT">Support agent</option>
                        <option value="BILLING_ADMIN">Billing admin</option>
                        <option value="AUDITOR">Auditor</option>
                      </select>
                    </Field>
                    <SubmitButton>Send invite</SubmitButton>
                  </form>
                </ActionPanel>
              </>
            ) : null}
          </div>
        </PageSection>

        <PageSection title="School Profiles">
          {data.tenants.length > 0 ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>School</th>
                    <th>Country</th>
                    <th>Timezone</th>
                    <th>Plan</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.tenants.map((tenant) => (
                    <tr key={tenant.id}>
                      <td>{tenant.name}</td>
                      <td>{tenant.country}</td>
                      <td>{tenant.timezone}</td>
                      <td>{tenant.planKey}</td>
                      <td>
                        <StatusPill tone={tenant.status === "ACTIVE" ? "good" : "neutral"}>
                          {humanize(tenant.status)}
                        </StatusPill>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title="No schools connected"
              body="Create the first school tenant to begin onboarding staff, classes, policies, and devices."
            />
          )}
        </PageSection>

        {selectedTenant ? (
          <PageSection kicker="Staff access" title="User Management">
            {data.users.length > 0 ? (
              <div className="list-panel">
                {data.users.map((user) => (
                  <article className="list-row dense" key={user.id}>
                    <div>
                      <strong>{user.name}</strong>
                      <span>{user.email}</span>
                      <small>
                        {humanize(user.role)} - MFA {user.mfaEnabled ? "enabled" : "not enabled"}
                      </small>
                    </div>
                    <div className="row-actions">
                      <StatusPill tone={userStatusTone(user.status)}>
                        {humanize(user.status)}
                      </StatusPill>
                      <form action={updateStaffRoleAction} className="row-form">
                        <input name="tenantId" type="hidden" value={selectedTenant.id} />
                        <input name="userId" type="hidden" value={user.id} />
                        <Field label="Role">
                          <select name="role" defaultValue={user.role}>
                            <option value="SCHOOL_ADMIN">School admin</option>
                            <option value="IT_ADMIN">IT admin</option>
                            <option value="ACADEMIC_ADMIN">Academic admin</option>
                            <option value="TEACHER">Teacher</option>
                            <option value="SUPPORT_AGENT">Support agent</option>
                            <option value="BILLING_ADMIN">Billing admin</option>
                            <option value="AUDITOR">Auditor</option>
                          </select>
                        </Field>
                        <button className="small-button" type="submit">
                          Update role
                        </button>
                      </form>
                      <form action={setStaffMfaAction} className="button-form">
                        <input name="tenantId" type="hidden" value={selectedTenant.id} />
                        <input name="userId" type="hidden" value={user.id} />
                        <input name="mfaEnabled" type="hidden" value={user.mfaEnabled ? "false" : "true"} />
                        <input name="reason" type="hidden" value="Updated from school admin console" />
                        <button className="small-button" type="submit">
                          {user.mfaEnabled ? "Clear MFA" : "Mark MFA"}
                        </button>
                      </form>
                      {user.status === "SUSPENDED" || user.status === "DEACTIVATED" ? (
                        <form action={reactivateStaffAction} className="button-form">
                          <input name="tenantId" type="hidden" value={selectedTenant.id} />
                          <input name="userId" type="hidden" value={user.id} />
                          <input name="reason" type="hidden" value="Access restored by administrator" />
                          <button className="small-button primary" type="submit">
                            Reactivate
                          </button>
                        </form>
                      ) : (
                        <>
                          <form action={suspendStaffAction} className="button-form">
                            <input name="tenantId" type="hidden" value={selectedTenant.id} />
                            <input name="userId" type="hidden" value={user.id} />
                            <input name="reason" type="hidden" value="Suspended by administrator" />
                            <button className="small-button" type="submit">
                              Suspend
                            </button>
                          </form>
                          <form action={deactivateStaffAction} className="button-form">
                            <input name="tenantId" type="hidden" value={selectedTenant.id} />
                            <input name="userId" type="hidden" value={user.id} />
                            <input name="reason" type="hidden" value="Deactivated by administrator" />
                            <button className="small-button danger" type="submit">
                              Deactivate
                            </button>
                          </form>
                        </>
                      )}
                      <form action={forceLogoutStaffAction} className="button-form">
                        <input name="tenantId" type="hidden" value={selectedTenant.id} />
                        <input name="userId" type="hidden" value={user.id} />
                        <input name="reason" type="hidden" value="Session reset by administrator" />
                        <button className="small-button" type="submit">
                          Force logout
                        </button>
                      </form>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState
                title="No staff accounts yet"
                body="Invite school admins, IT admins, academic admins, teachers, support agents, and billing contacts."
              />
            )}
          </PageSection>
        ) : null}
      </div>
    </AppShell>
  );
}

function userStatusTone(status: string): "neutral" | "good" | "warning" | "critical" {
  if (status === "ACTIVE") return "good";
  if (status === "SUSPENDED") return "warning";
  if (status === "DEACTIVATED") return "critical";
  return "neutral";
}

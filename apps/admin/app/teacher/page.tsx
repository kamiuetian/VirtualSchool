import { AppShell } from "../../components/app-shell";
import { ActionPanel, EmptyState, Field, PageSection, StatCard, StatusPill, SubmitButton } from "../../components/ui";
import { approveTeacherTemporaryUrlAction, endTeacherSessionAction, pushTeacherResourceAction, showTeacherFocusScreenAction, startTeacherSessionAction } from "../../lib/actions";
import { getAdminData, getTeacherDashboard } from "../../lib/api";
import { formatCount, formatDateTime, humanize } from "../../lib/format";

export const dynamic = "force-dynamic";

export default async function TeacherPage() {
  const data = await getAdminData("/teacher");
  const result = data.selectedTenant
    ? await getTeacherDashboard(data.selectedTenant.id)
    : { dashboard: null, connectionIssue: false };
  const dashboard = result.dashboard;
  const offline = dashboard?.devices.filter((device) => device.status === "OFFLINE").length ?? 0;

  return (
    <AppShell connectionIssue={data.connectionIssue || result.connectionIssue} tenant={data.selectedTenant}>
      <div className="content-stack">
        <PageSection kicker="Teacher workspace" title="Live Class Mode">
          <section className="stat-grid" aria-label="Teacher class summary">
            <StatCard label="Assigned classes" value={formatCount(dashboard?.classes.length ?? 0)} />
            <StatCard label="Assigned devices" value={formatCount(dashboard?.devices.length ?? 0)} />
            <StatCard label="Offline" tone={offline ? "warning" : "good"} value={formatCount(offline)} />
            <StatCard label="Class mode" tone={dashboard?.activeSession ? "good" : "neutral"} value={dashboard?.activeSession ? "Active" : "Stopped"} />
          </section>
        </PageSection>

        {!dashboard || dashboard.classes.length === 0 ? (
          <EmptyState title="No assigned classes" body="Ask an academic administrator to assign your teacher profile to a class." />
        ) : dashboard.activeSession ? (
          <PageSection kicker="Guarded session" title={dashboard.activeSession.className}>
            <ActionPanel title="End class mode">
              <p>Started {formatDateTime(dashboard.activeSession.startedAt)}. Ending class mode is durable and requires a reason.</p>
              <form action={endTeacherSessionAction} className="inline-form wide">
                <input name="tenantId" type="hidden" value={data.selectedTenant!.id} />
                <input name="sessionId" type="hidden" value={dashboard.activeSession.id} />
                <Field label="Reason"><input name="reason" minLength={3} placeholder="Lesson completed" required /></Field>
                <SubmitButton>End class mode</SubmitButton>
              </form>
            </ActionPanel>
            <div className="action-grid">
              <ActionPanel title="Push approved resource">
                <form action={pushTeacherResourceAction} className="inline-form wide">
                  <input name="tenantId" type="hidden" value={data.selectedTenant!.id} /><input name="sessionId" type="hidden" value={dashboard.activeSession.id} />
                  <Field label="Resource"><select name="resourceId" required>{dashboard.approvedResources.map((resource) => <option key={resource.id} value={resource.id}>{resource.name}</option>)}</select></Field>
                  <SubmitButton>Push resource</SubmitButton>
                </form>
              </ActionPanel>
              <ActionPanel title="Display focus screen">
                <form action={showTeacherFocusScreenAction} className="inline-form wide">
                  <input name="tenantId" type="hidden" value={data.selectedTenant!.id} /><input name="sessionId" type="hidden" value={dashboard.activeSession.id} />
                  <Field label="Message"><input name="message" maxLength={500} required /></Field><Field label="Minutes"><input name="durationMinutes" type="number" min={1} max={10} defaultValue={3} required /></Field>
                  <SubmitButton>Display focus screen</SubmitButton>
                </form>
              </ActionPanel>
              <ActionPanel title="Temporarily approve URL">
                <p>Expires automatically and cannot override blocked policy rules.</p>
                <form action={approveTeacherTemporaryUrlAction} className="inline-form wide">
                  <input name="tenantId" type="hidden" value={data.selectedTenant!.id} /><input name="sessionId" type="hidden" value={dashboard.activeSession.id} />
                  <Field label="URL"><input name="url" type="url" maxLength={2048} required /></Field><Field label="Minutes"><input name="durationMinutes" type="number" min={1} max={60} defaultValue={15} required /></Field>
                  <SubmitButton>Approve temporarily</SubmitButton>
                </form>
              </ActionPanel>
            </div>
          </PageSection>
        ) : (
          <PageSection kicker="Guarded session" title="Start Class Mode">
            <ActionPanel title="Select one assigned class">
              <form action={startTeacherSessionAction} className="inline-form wide">
                <input name="tenantId" type="hidden" value={data.selectedTenant!.id} />
                <Field label="Class"><select name="classId" required>{dashboard.classes.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.grade}</option>)}</select></Field>
                <SubmitButton>Start class mode</SubmitButton>
              </form>
            </ActionPanel>
          </PageSection>
        )}

        {dashboard ? <PageSection kicker="Scoped fleet" title="Assigned Devices">
          {dashboard.devices.length === 0 ? <EmptyState title="No class devices" body="Devices appear here only when assigned to one of your classes." /> :
            <div className="table-wrap"><table><thead><tr><th>Device</th><th>Class</th><th>Status</th><th>Compliance</th><th>Last check-in</th></tr></thead><tbody>{dashboard.devices.map((device) => <tr key={device.id}><td>{device.serialNumber}</td><td>{dashboard.classes.find((item) => item.id === device.classId)?.name ?? "—"}</td><td><StatusPill tone={device.status === "ONLINE" ? "good" : "warning"}>{humanize(device.status)}</StatusPill></td><td>{humanize(device.compliance)}</td><td>{device.lastCheckInAt ? formatDateTime(device.lastCheckInAt) : "Never"}</td></tr>)}</tbody></table></div>}
        </PageSection> : null}

        {dashboard && dashboard.recentSessions.length > 0 ? <PageSection kicker="Durable history" title="Recent Sessions">
          <div className="table-wrap"><table><thead><tr><th>Class</th><th>Started</th><th>Ended</th><th>Status</th><th>Events</th></tr></thead><tbody>{dashboard.recentSessions.map((session) => <tr key={session.id}><td>{session.className}</td><td>{formatDateTime(session.startedAt)}</td><td>{session.endedAt ? formatDateTime(session.endedAt) : "—"}</td><td><StatusPill tone={session.status === "ACTIVE" ? "good" : "neutral"}>{humanize(session.status)}</StatusPill></td><td>{formatCount(session.events.length)}</td></tr>)}</tbody></table></div>
        </PageSection> : null}
      </div>
    </AppShell>
  );
}

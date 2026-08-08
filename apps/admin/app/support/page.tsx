import Link from "next/link";
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
  applyRetentionAction,
  createSupportNoteAction,
  dryRunRetentionAction,
  updateRetentionSettingsAction,
  updateSupportNoteAction,
  createSupportTicketAction,
  updateSupportTicketAction,
  addSupportTicketNoteAction,
  startRemoteAssistanceAction,
  endRemoteAssistanceAction,
} from "../../lib/actions";
import { getAdminData, getDeviceSupportData } from "../../lib/api";
import { roleCan } from "../../lib/auth/portal-access";
import { formatCount, formatDateTime, humanize } from "../../lib/format";

export const dynamic = "force-dynamic";

export default async function SupportPage({
  searchParams,
}: {
  searchParams?: Promise<{ deviceId?: string }>;
}) {
  const params = await searchParams;
  const data = await getAdminData("/support");
  const selectedTenant = data.selectedTenant;
  const canManageSupport =
    roleCan(data.session.role, "device:command") ||
    roleCan(data.session.role, "tenant:update");
  const canCreateTickets = roleCan(data.session.role, "device:read");
  const canManageRetention = roleCan(data.session.role, "tenant:update");
  const selectedDevice =
    data.devices.find((device) => device.id === params?.deviceId) ??
    data.devices[0] ??
    null;
  const supportData =
    selectedTenant && selectedDevice
      ? await getDeviceSupportData(selectedTenant.id, selectedDevice.id)
      : {
          connectionIssue: false,
          notes: [],
          timeline: [],
          tickets: [],
          assistanceSessions: [],
          playbooks: [],
        };

  return (
    <AppShell
      connectionIssue={data.connectionIssue || supportData.connectionIssue}
      tenant={selectedTenant}
    >
      <div className="content-stack">
        <PageSection kicker="Support desk" title="Device Support">
          <section className="stat-grid" aria-label="Support summary">
            <StatCard
              label="Devices"
              value={formatCount(data.devices.length)}
            />
            <StatCard
              label="Open tickets"
              tone={
                supportData.tickets.some(
                  (ticket) => !["RESOLVED", "CLOSED"].includes(ticket.status),
                )
                  ? "warning"
                  : "good"
              }
              value={formatCount(
                supportData.tickets.filter(
                  (ticket) => !["RESOLVED", "CLOSED"].includes(ticket.status),
                ).length,
              )}
            />
            <StatCard
              label="Pinned"
              value={formatCount(
                supportData.notes.filter((note) => note.pinned).length,
              )}
            />
            <StatCard
              label="Timeline events"
              value={formatCount(supportData.timeline.length)}
            />
          </section>
        </PageSection>

        <PageSection kicker="Consented support" title="Remote Assistance">
          <p className="section-copy">
            Assistance is visible, permissioned, and logged. It never enables
            hidden camera, microphone, keystroke, private-message, or screenshot
            monitoring.
          </p>
          {selectedTenant && selectedDevice && canManageSupport ? (
            <div className="form-grid two">
              <ActionPanel title="Start visible session">
                <form
                  action={startRemoteAssistanceAction}
                  className="stacked-form"
                >
                  <input
                    name="tenantId"
                    type="hidden"
                    value={selectedTenant.id}
                  />
                  <input
                    name="deviceId"
                    type="hidden"
                    value={selectedDevice.id}
                  />
                  <Field label="Purpose">
                    <input name="purpose" minLength={5} required />
                  </Field>
                  <Field label="Consenting person">
                    <input
                      name="consentedBy"
                      placeholder="Name and relationship/role"
                      required
                    />
                  </Field>
                  <Field label="Linked ticket (optional)">
                    <input name="ticketId" />
                  </Field>
                  <label className="check-field">
                    <input name="noticeAcknowledged" type="checkbox" required />
                    <span>
                      The device user can see the assistance notice and has
                      explicitly consented.
                    </span>
                  </label>
                  <SubmitButton>Start assistance</SubmitButton>
                </form>
              </ActionPanel>
              <ActionPanel title="Session history">
                {supportData.assistanceSessions.length ? (
                  supportData.assistanceSessions.map((session) => (
                    <article className="list-row" key={session.id}>
                      <div>
                        <strong>{humanize(session.status)}</strong>
                        <span>{session.purpose}</span>
                        <small>
                          Consent: {session.consentedBy} ·{" "}
                          {formatDateTime(session.startedAt)}
                        </small>
                      </div>
                      {session.status === "ACTIVE" ? (
                        <form
                          action={endRemoteAssistanceAction}
                          className="stacked-form"
                        >
                          <input
                            name="tenantId"
                            type="hidden"
                            value={selectedTenant.id}
                          />
                          <input
                            name="sessionId"
                            type="hidden"
                            value={session.id}
                          />
                          <input
                            name="resolution"
                            placeholder="Resolution and handoff"
                            required
                          />
                          <button className="small-button primary">
                            End and log
                          </button>
                        </form>
                      ) : (
                        <small>{session.resolution}</small>
                      )}
                    </article>
                  ))
                ) : (
                  <EmptyState
                    title="No assistance sessions"
                    body="Explicitly consented sessions will appear here with start and end evidence."
                  />
                )}
              </ActionPanel>
            </div>
          ) : null}
        </PageSection>

        <PageSection
          kicker="Guided resolution"
          title="Troubleshooting Playbooks"
        >
          <div className="form-grid two">
            {supportData.playbooks.map((playbook) => (
              <ActionPanel title={playbook.title} key={playbook.id}>
                <ol>
                  {playbook.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
                <p>
                  <strong>Escalation:</strong> {playbook.escalation}
                </p>
              </ActionPanel>
            ))}
          </div>
        </PageSection>

        <PageSection title="Support Workspace">
          {selectedDevice && selectedTenant ? (
            <div className="support-layout">
              <ActionPanel title="Select tablet">
                <div className="device-picker">
                  {data.devices.map((device) => (
                    <Link
                      className={
                        device.id === selectedDevice.id
                          ? "device-picker-item active"
                          : "device-picker-item"
                      }
                      href={`/support?deviceId=${device.id}`}
                      key={device.id}
                    >
                      <strong>{device.serialNumber}</strong>
                      <span>
                        {device.model ??
                          device.manufacturer ??
                          "Android tablet"}
                      </span>
                    </Link>
                  ))}
                </div>
              </ActionPanel>

              {canManageSupport ? (
                <ActionPanel title="Create support note">
                  <form
                    action={createSupportNoteAction}
                    className="stacked-form"
                  >
                    <input
                      name="tenantId"
                      type="hidden"
                      value={selectedTenant.id}
                    />
                    <input
                      name="deviceId"
                      type="hidden"
                      value={selectedDevice.id}
                    />
                    <div className="form-row">
                      <Field label="Category">
                        <select name="category" defaultValue="GENERAL">
                          <option value="GENERAL">General</option>
                          <option value="INCIDENT">Incident</option>
                          <option value="ESCALATION">Escalation</option>
                          <option value="DEPLOYMENT">Deployment</option>
                          <option value="ENROLLMENT">Enrollment</option>
                          <option value="PRIVACY">Privacy</option>
                        </select>
                      </Field>
                      <Field label="Severity">
                        <select name="severity" defaultValue="S3">
                          <option value="S1">S1</option>
                          <option value="S2">S2</option>
                          <option value="S3">S3</option>
                          <option value="S4">S4</option>
                        </select>
                      </Field>
                    </div>
                    <Field label="Visibility">
                      <select name="visibility" defaultValue="INTERNAL">
                        <option value="INTERNAL">Internal</option>
                        <option value="SCHOOL">School visible</option>
                      </select>
                    </Field>
                    <Field label="Note">
                      <textarea
                        name="body"
                        placeholder="Record the support finding or next action"
                        required
                      />
                    </Field>
                    <label className="check-field">
                      <input name="pinned" type="checkbox" />
                      <span>Pin note to device record</span>
                    </label>
                    <input name="status" type="hidden" value="OPEN" />
                    <SubmitButton>Add note</SubmitButton>
                  </form>
                </ActionPanel>
              ) : null}
            </div>
          ) : (
            <EmptyState
              title="No tablet selected"
              body="Enroll a managed Android tablet before recording support notes or viewing device timelines."
            />
          )}
        </PageSection>

        <PageSection kicker="Helpdesk workflow" title="Support Tickets">
          {selectedTenant && selectedDevice && canCreateTickets ? (
            <form
              action={createSupportTicketAction}
              className="action-panel content-stack"
            >
              <input name="tenantId" type="hidden" value={selectedTenant.id} />
              <input name="deviceId" type="hidden" value={selectedDevice.id} />
              <input
                name="classId"
                type="hidden"
                value={selectedDevice.classId ?? ""}
              />
              <div className="inline-form">
                <Field label="Subject">
                  <input name="subject" required />
                </Field>
                <Field label="Category">
                  <select name="category">
                    <option>GENERAL</option>
                    <option>INCIDENT</option>
                    <option>ENROLLMENT</option>
                    <option>PRIVACY</option>
                  </select>
                </Field>
                <Field label="Priority">
                  <select name="priority">
                    <option>NORMAL</option>
                    <option>LOW</option>
                    <option>HIGH</option>
                    <option>URGENT</option>
                  </select>
                </Field>
              </div>
              <Field label="Description">
                <textarea name="description" required />
              </Field>
              <SubmitButton>Open routed ticket</SubmitButton>
            </form>
          ) : null}
          {supportData.tickets.length ? (
            <div className="list-panel">
              {supportData.tickets.map((ticket) => (
                <article className="list-row" key={ticket.id}>
                  <div>
                    <strong>{ticket.subject}</strong>
                    <span>{ticket.description}</span>
                    <small>
                      {ticket.routingQueue} · SLA{" "}
                      {formatDateTime(ticket.slaDueAt)} ·{" "}
                      {ticket.assigneeId ?? "Unassigned"}
                    </small>
                    <form
                      action={addSupportTicketNoteAction}
                      className="row-form"
                    >
                      <input
                        name="tenantId"
                        type="hidden"
                        value={selectedTenant?.id}
                      />
                      <input name="ticketId" type="hidden" value={ticket.id} />
                      <input
                        name="body"
                        placeholder="Add scoped note"
                        required
                      />
                      <select name="visibility">
                        <option value="INTERNAL">Internal</option>
                        <option value="SCHOOL">School visible</option>
                      </select>
                      <button className="small-button">Add note</button>
                    </form>
                    {ticket.notes.map((note) => (
                      <small key={note.id}>
                        {humanize(note.visibility)}: {note.body}
                      </small>
                    ))}
                  </div>
                  <div className="row-actions">
                    <StatusPill
                      tone={ticket.status === "RESOLVED" ? "good" : "warning"}
                    >
                      {humanize(ticket.status)} · {humanize(ticket.priority)}
                    </StatusPill>
                    {canManageSupport ? (
                      <form
                        action={updateSupportTicketAction}
                        className="row-form"
                      >
                        <input
                          name="tenantId"
                          type="hidden"
                          value={selectedTenant?.id}
                        />
                        <input
                          name="ticketId"
                          type="hidden"
                          value={ticket.id}
                        />
                        <input
                          name="priority"
                          type="hidden"
                          value={ticket.priority}
                        />
                        <input
                          name="assigneeId"
                          defaultValue={ticket.assigneeId ?? ""}
                          placeholder="Assignee ID"
                        />
                        <select name="status" defaultValue={ticket.status}>
                          <option>OPEN</option>
                          <option>IN_PROGRESS</option>
                          <option>WAITING</option>
                          <option>RESOLVED</option>
                          <option>CLOSED</option>
                        </select>
                        <button className="small-button primary">Update</button>
                      </form>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No support tickets"
              body="Linked staff, guardian, and automation tickets will appear here."
            />
          )}
        </PageSection>

        <PageSection title="Support Notes">
          {supportData.notes.length > 0 && selectedTenant ? (
            <div className="list-panel">
              {supportData.notes.map((note) => (
                <article className="list-row" key={note.id}>
                  <div>
                    <strong>
                      {humanize(note.category)} - {note.severity}
                    </strong>
                    <span>{note.body}</span>
                    <small>{formatDateTime(note.updatedAt)}</small>
                  </div>
                  <div className="row-actions">
                    <StatusPill
                      tone={note.status === "RESOLVED" ? "good" : "warning"}
                    >
                      {humanize(note.status)}
                    </StatusPill>
                    {canManageSupport ? (
                      <form
                        action={updateSupportNoteAction}
                        className="row-form"
                      >
                        <input
                          name="tenantId"
                          type="hidden"
                          value={selectedTenant.id}
                        />
                        <input name="noteId" type="hidden" value={note.id} />
                        <Field label="Status">
                          <select name="status" defaultValue={note.status}>
                            <option value="OPEN">Open</option>
                            <option value="IN_PROGRESS">In progress</option>
                            <option value="RESOLVED">Resolved</option>
                          </select>
                        </Field>
                        <button className="small-button primary" type="submit">
                          Save
                        </button>
                      </form>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No support notes"
              body="Support notes capture device context, escalation history, privacy-sensitive decisions, and resolution state."
            />
          )}
        </PageSection>

        <PageSection title="Device Timeline">
          {supportData.timeline.length > 0 ? (
            <div className="list-panel">
              {supportData.timeline.map((event) => (
                <article className="list-row dense" key={event.id}>
                  <div>
                    <strong>{event.title}</strong>
                    <span>{event.summary}</span>
                    <small>{formatDateTime(event.occurredAt)}</small>
                  </div>
                  <StatusPill>{humanize(event.type)}</StatusPill>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No timeline events"
              body="Commands, diagnostics, alerts, and support notes will build a service history for the selected tablet."
            />
          )}
        </PageSection>

        {selectedTenant && canManageRetention && data.retentionSettings ? (
          <PageSection kicker="Privacy operations" title="Retention Settings">
            <div className="form-grid two">
              <ActionPanel title="Data retention windows">
                <form
                  action={updateRetentionSettingsAction}
                  className="stacked-form"
                >
                  <input
                    name="tenantId"
                    type="hidden"
                    value={selectedTenant.id}
                  />
                  <div className="form-row">
                    <Field label="Diagnostics days">
                      <input
                        defaultValue={
                          data.retentionSettings.diagnosticRetentionDays
                        }
                        min="7"
                        name="diagnosticRetentionDays"
                        type="number"
                      />
                    </Field>
                    <Field label="Resolved alert days">
                      <input
                        defaultValue={
                          data.retentionSettings.resolvedAlertRetentionDays
                        }
                        min="7"
                        name="resolvedAlertRetentionDays"
                        type="number"
                      />
                    </Field>
                  </div>
                  <div className="form-row">
                    <Field label="Command history days">
                      <input
                        defaultValue={
                          data.retentionSettings.commandHistoryRetentionDays
                        }
                        min="30"
                        name="commandHistoryRetentionDays"
                        type="number"
                      />
                    </Field>
                    <Field label="Support note days">
                      <input
                        defaultValue={
                          data.retentionSettings.supportNoteRetentionDays
                        }
                        min="30"
                        name="supportNoteRetentionDays"
                        type="number"
                      />
                    </Field>
                  </div>
                  <div className="form-row">
                    <Field label="Export artifact days">
                      <input
                        defaultValue={
                          data.retentionSettings.exportArtifactRetentionDays
                        }
                        min="1"
                        name="exportArtifactRetentionDays"
                        type="number"
                      />
                    </Field>
                    <Field label="Audit days">
                      <input
                        defaultValue={
                          data.retentionSettings.auditRetentionDays ?? ""
                        }
                        min="365"
                        name="auditRetentionDays"
                        placeholder="Retain indefinitely"
                        type="number"
                      />
                    </Field>
                  </div>
                  <SubmitButton>Save retention</SubmitButton>
                </form>
              </ActionPanel>

              <ActionPanel title="Retention run">
                <form action={dryRunRetentionAction} className="stacked-form">
                  <input
                    name="tenantId"
                    type="hidden"
                    value={selectedTenant.id}
                  />
                  <Field label="Reason">
                    <input
                      name="reason"
                      placeholder="Monthly privacy operations review"
                    />
                  </Field>
                  <SubmitButton>Preview cleanup</SubmitButton>
                </form>
                <form action={applyRetentionAction} className="stacked-form">
                  <input
                    name="tenantId"
                    type="hidden"
                    value={selectedTenant.id}
                  />
                  <Field label="Reason">
                    <input
                      name="reason"
                      placeholder="Approved retention cleanup"
                      required
                    />
                  </Field>
                  <button className="submit-button danger" type="submit">
                    Apply cleanup
                  </button>
                </form>
              </ActionPanel>
            </div>
          </PageSection>
        ) : null}
      </div>
    </AppShell>
  );
}

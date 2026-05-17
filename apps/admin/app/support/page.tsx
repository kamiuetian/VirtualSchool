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
} from "../../lib/actions";
import { getAdminData, getDeviceSupportData } from "../../lib/api";
import { formatCount, formatDateTime, humanize } from "../../lib/format";

export const dynamic = "force-dynamic";

export default async function SupportPage({
  searchParams,
}: {
  searchParams?: Promise<{ deviceId?: string }>;
}) {
  const params = await searchParams;
  const data = await getAdminData();
  const selectedTenant = data.selectedTenant;
  const selectedDevice =
    data.devices.find((device) => device.id === params?.deviceId) ??
    data.devices[0] ??
    null;
  const supportData =
    selectedTenant && selectedDevice
      ? await getDeviceSupportData(selectedTenant.id, selectedDevice.id)
      : { connectionIssue: false, notes: [], timeline: [] };
  const openNotes = supportData.notes.filter((note) => note.status !== "RESOLVED");

  return (
    <AppShell
      connectionIssue={data.connectionIssue || supportData.connectionIssue}
      tenant={selectedTenant}
    >
      <div className="content-stack">
        <PageSection kicker="Support desk" title="Device Support">
          <section className="stat-grid" aria-label="Support summary">
            <StatCard label="Devices" value={formatCount(data.devices.length)} />
            <StatCard
              label="Open notes"
              tone={openNotes.length > 0 ? "warning" : "good"}
              value={formatCount(openNotes.length)}
            />
            <StatCard
              label="Pinned"
              value={formatCount(supportData.notes.filter((note) => note.pinned).length)}
            />
            <StatCard
              label="Timeline events"
              value={formatCount(supportData.timeline.length)}
            />
          </section>
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
                      <span>{device.model ?? device.manufacturer ?? "Android tablet"}</span>
                    </Link>
                  ))}
                </div>
              </ActionPanel>

              <ActionPanel title="Create support note">
                <form action={createSupportNoteAction} className="stacked-form">
                  <input name="tenantId" type="hidden" value={selectedTenant.id} />
                  <input name="deviceId" type="hidden" value={selectedDevice.id} />
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
                    <textarea name="body" placeholder="Record the support finding or next action" required />
                  </Field>
                  <label className="check-field">
                    <input name="pinned" type="checkbox" />
                    <span>Pin note to device record</span>
                  </label>
                  <input name="status" type="hidden" value="OPEN" />
                  <SubmitButton>Add note</SubmitButton>
                </form>
              </ActionPanel>
            </div>
          ) : (
            <EmptyState
              title="No tablet selected"
              body="Enroll a managed Android tablet before recording support notes or viewing device timelines."
            />
          )}
        </PageSection>

        <PageSection title="Support Notes">
          {supportData.notes.length > 0 && selectedTenant ? (
            <div className="list-panel">
              {supportData.notes.map((note) => (
                <article className="list-row" key={note.id}>
                  <div>
                    <strong>{humanize(note.category)} - {note.severity}</strong>
                    <span>{note.body}</span>
                    <small>{formatDateTime(note.updatedAt)}</small>
                  </div>
                  <div className="row-actions">
                    <StatusPill tone={note.status === "RESOLVED" ? "good" : "warning"}>
                      {humanize(note.status)}
                    </StatusPill>
                    <form action={updateSupportNoteAction} className="row-form">
                      <input name="tenantId" type="hidden" value={selectedTenant.id} />
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

        {selectedTenant && data.retentionSettings ? (
          <PageSection kicker="Privacy operations" title="Retention Settings">
            <div className="form-grid two">
              <ActionPanel title="Data retention windows">
                <form action={updateRetentionSettingsAction} className="stacked-form">
                  <input name="tenantId" type="hidden" value={selectedTenant.id} />
                  <div className="form-row">
                    <Field label="Diagnostics days">
                      <input
                        defaultValue={data.retentionSettings.diagnosticRetentionDays}
                        min="7"
                        name="diagnosticRetentionDays"
                        type="number"
                      />
                    </Field>
                    <Field label="Resolved alert days">
                      <input
                        defaultValue={data.retentionSettings.resolvedAlertRetentionDays}
                        min="7"
                        name="resolvedAlertRetentionDays"
                        type="number"
                      />
                    </Field>
                  </div>
                  <div className="form-row">
                    <Field label="Command history days">
                      <input
                        defaultValue={data.retentionSettings.commandHistoryRetentionDays}
                        min="30"
                        name="commandHistoryRetentionDays"
                        type="number"
                      />
                    </Field>
                    <Field label="Support note days">
                      <input
                        defaultValue={data.retentionSettings.supportNoteRetentionDays}
                        min="30"
                        name="supportNoteRetentionDays"
                        type="number"
                      />
                    </Field>
                  </div>
                  <div className="form-row">
                    <Field label="Export artifact days">
                      <input
                        defaultValue={data.retentionSettings.exportArtifactRetentionDays}
                        min="1"
                        name="exportArtifactRetentionDays"
                        type="number"
                      />
                    </Field>
                    <Field label="Audit days">
                      <input
                        defaultValue={data.retentionSettings.auditRetentionDays ?? ""}
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
                  <input name="tenantId" type="hidden" value={selectedTenant.id} />
                  <Field label="Reason">
                    <input name="reason" placeholder="Monthly privacy operations review" />
                  </Field>
                  <SubmitButton>Preview cleanup</SubmitButton>
                </form>
                <form action={applyRetentionAction} className="stacked-form">
                  <input name="tenantId" type="hidden" value={selectedTenant.id} />
                  <Field label="Reason">
                    <input name="reason" placeholder="Approved retention cleanup" required />
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

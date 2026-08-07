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
  createTimetableBlockAction,
  createCalendarExceptionAction,
  deactivateTimetableBlockAction,
} from "../../lib/actions";
import { getAdminData } from "../../lib/api";
import { formatCount, formatDate, humanize } from "../../lib/format";

export const dynamic = "force-dynamic";

const weekdays = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

export default async function TimetablePage() {
  const data = await getAdminData("/timetable");
  const activeBlocks = data.timetableBlocks.filter((block) => block.active);
  const classBlocks = data.timetableBlocks.filter(
    (block) => block.scope === "CLASS",
  );

  return (
    <AppShell
      connectionIssue={data.connectionIssue}
      tenant={data.selectedTenant}
    >
      <div className="content-stack">
        <PageSection kicker="Learning day" title="Timetable Blocks">
          <section className="stat-grid" aria-label="Timetable summary">
            <StatCard
              label="Blocks"
              value={formatCount(data.timetableBlocks.length)}
            />
            <StatCard
              label="Active"
              tone="good"
              value={formatCount(activeBlocks.length)}
            />
            <StatCard
              label="Class scoped"
              value={formatCount(classBlocks.length)}
            />
            <StatCard
              label="Policies available"
              value={formatCount(
                data.policies.filter((policy) => policy.status === "PUBLISHED")
                  .length,
              )}
            />
          </section>
        </PageSection>

        {data.selectedTenant ? (
          <PageSection kicker="Schedule action" title="Create Recurring Block">
            <ActionPanel title="Class, grade, or whole-school mode">
              <form
                action={createTimetableBlockAction}
                className="inline-form wide"
              >
                <input
                  name="tenantId"
                  type="hidden"
                  value={data.selectedTenant.id}
                />
                <Field label="Block name">
                  <input
                    name="name"
                    placeholder="Grade 4 Mathematics"
                    required
                  />
                </Field>
                <Field label="Published policy">
                  <select name="policyId" required>
                    {data.policies.map((policy) => (
                      <option key={policy.id} value={policy.id}>
                        {policy.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Scope">
                  <select name="scope" defaultValue="CLASS">
                    <option value="TENANT">Whole school</option>
                    <option value="GRADE">Grade</option>
                    <option value="CLASS">Class</option>
                  </select>
                </Field>
                <Field label="Target ID">
                  <input name="scopeId" placeholder="Class or grade value" />
                </Field>
                <Field label="Subject">
                  <input name="subject" placeholder="Mathematics" />
                </Field>
                <Field label="Day">
                  <select name="dayOfWeek" defaultValue="1">
                    {weekdays.map((day, index) => (
                      <option key={day} value={index + 1}>
                        {day}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Start">
                  <input name="startTime" required type="time" />
                </Field>
                <Field label="End">
                  <input name="endTime" required type="time" />
                </Field>
                <Field label="Timezone">
                  <input
                    name="timezone"
                    placeholder={data.selectedTenant.timezone}
                  />
                </Field>
                <Field label="Reason">
                  <input name="reason" placeholder="Academic timetable setup" />
                </Field>
                <SubmitButton>Create block</SubmitButton>
              </form>
            </ActionPanel>
          </PageSection>
        ) : null}

        {data.selectedTenant ? (
          <PageSection
            kicker="Calendar exception"
            title="Holidays And Dated Overrides"
          >
            <ActionPanel title="Override the recurring timetable for a local date">
              <form
                action={createCalendarExceptionAction}
                className="inline-form wide"
              >
                <input
                  name="tenantId"
                  type="hidden"
                  value={data.selectedTenant.id}
                />
                <Field label="Name">
                  <input name="name" placeholder="Public holiday" required />
                </Field>
                <Field label="Local date">
                  <input name="localDate" type="date" required />
                </Field>
                <Field label="Type">
                  <select name="kind" defaultValue="CLOSED">
                    <option value="CLOSED">Closed</option>
                    <option value="OVERRIDE">Policy override</option>
                  </select>
                </Field>
                <Field label="Scope">
                  <select name="scope" defaultValue="TENANT">
                    <option value="TENANT">Whole school</option>
                    <option value="GRADE">Grade</option>
                    <option value="CLASS">Class</option>
                  </select>
                </Field>
                <Field label="Target ID">
                  <input name="scopeId" placeholder="Class or grade value" />
                </Field>
                <Field label="Override policy">
                  <select name="policyId">
                    <option value="">Not required for closure</option>
                    {data.policies.map((policy) => (
                      <option key={policy.id} value={policy.id}>
                        {policy.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Timezone">
                  <input
                    name="timezone"
                    placeholder={data.selectedTenant.timezone}
                  />
                </Field>
                <Field label="Reason">
                  <input name="reason" placeholder="Academic calendar" />
                </Field>
                <SubmitButton>Create exception</SubmitButton>
              </form>
            </ActionPanel>
            {data.calendarExceptions.length > 0 ? (
              <div className="card-grid compact">
                {data.calendarExceptions.map((item) => (
                  <article className="record-card" key={item.id}>
                    <div>
                      <strong>{item.name}</strong>
                      <span>
                        {item.localDate} · {humanize(item.scope)}
                      </span>
                    </div>
                    <StatusPill
                      tone={item.kind === "CLOSED" ? "neutral" : "good"}
                    >
                      {humanize(item.kind)}
                    </StatusPill>
                  </article>
                ))}
              </div>
            ) : null}
          </PageSection>
        ) : null}

        <PageSection title="Weekly Schedule">
          {data.timetableBlocks.length > 0 ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Block</th>
                    <th>Policy</th>
                    <th>Scope</th>
                    <th>Day</th>
                    <th>Time</th>
                    <th>Effective</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {data.timetableBlocks.map((block) => (
                    <tr key={block.id}>
                      <td>
                        <strong>{block.name}</strong>
                        <span className="cell-note">
                          {block.subject ?? "Learning block"}
                        </span>
                      </td>
                      <td>{block.policyName}</td>
                      <td>
                        {humanize(block.scope)}
                        {block.scopeId ? ` - ${block.scopeId}` : ""}
                      </td>
                      <td>{weekdays[block.dayOfWeek - 1]}</td>
                      <td>
                        {minuteLabel(block.startMinute)} to{" "}
                        {minuteLabel(block.endMinute)}
                      </td>
                      <td>
                        {formatDate(block.effectiveFrom)} to{" "}
                        {formatDate(block.effectiveUntil)}
                      </td>
                      <td>
                        <StatusPill tone={block.active ? "good" : "neutral"}>
                          {block.active ? "Active" : "Inactive"}
                        </StatusPill>
                      </td>
                      <td>
                        {data.selectedTenant && block.active ? (
                          <form
                            action={deactivateTimetableBlockAction}
                            className="button-form"
                          >
                            <input
                              name="tenantId"
                              type="hidden"
                              value={data.selectedTenant.id}
                            />
                            <input
                              name="blockId"
                              type="hidden"
                              value={block.id}
                            />
                            <input
                              name="reason"
                              type="hidden"
                              value="Removed from active timetable"
                            />
                            <button className="small-button" type="submit">
                              Deactivate
                            </button>
                          </form>
                        ) : (
                          "No action"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title="No timetable blocks"
              body="Create recurring blocks to apply class, grade, or whole-school learning modes during the school week."
            />
          )}
        </PageSection>
      </div>
    </AppShell>
  );
}

function minuteLabel(value: number): string {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
}

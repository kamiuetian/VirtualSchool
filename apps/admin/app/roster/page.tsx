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
import { createClassAction, createStudentAction } from "../../lib/actions";
import { getAdminData } from "../../lib/api";
import { formatCount, humanize } from "../../lib/format";

export const dynamic = "force-dynamic";

export default async function RosterPage() {
  const data = await getAdminData();
  const activeStudents = data.students.filter((student) => student.status === "ACTIVE");

  return (
    <AppShell connectionIssue={data.connectionIssue} tenant={data.selectedTenant}>
      <div className="content-stack">
        <PageSection kicker="Academic structure" title="Roster And Classes">
          <section className="stat-grid" aria-label="Roster summary">
            <StatCard label="Students" value={formatCount(data.students.length)} />
            <StatCard label="Active students" tone="good" value={formatCount(activeStudents.length)} />
            <StatCard label="Classes" value={formatCount(data.classes.length)} />
            <StatCard
              label="Guardian links"
              value={formatCount(
                data.students.reduce((total, student) => total + student.guardianCount, 0),
              )}
            />
          </section>
        </PageSection>

        {data.selectedTenant ? (
          <PageSection kicker="Roster actions" title="Manual Roster Updates">
            <div className="form-grid">
              <ActionPanel title="Create class">
                <form action={createClassAction} className="stacked-form">
                  <input name="tenantId" type="hidden" value={data.selectedTenant.id} />
                  <Field label="Class name">
                    <input name="name" placeholder="Grade 4 Blue" required />
                  </Field>
                  <div className="form-row">
                    <Field label="Grade">
                      <input name="grade" placeholder="4" required />
                    </Field>
                    <Field label="Subject">
                      <input name="subject" placeholder="Science" />
                    </Field>
                  </div>
                  <SubmitButton>Create class</SubmitButton>
                </form>
              </ActionPanel>

              <ActionPanel title="Create student">
                <form action={createStudentAction} className="stacked-form">
                  <input name="tenantId" type="hidden" value={data.selectedTenant.id} />
                  <div className="form-row">
                    <Field label="Student code">
                      <input name="studentCode" placeholder="S-1001" required />
                    </Field>
                    <Field label="Status">
                      <select name="status" defaultValue="ACTIVE">
                        <option value="ACTIVE">Active</option>
                        <option value="PENDING">Pending</option>
                      </select>
                    </Field>
                  </div>
                  <Field label="Student name">
                    <input name="name" placeholder="Sara Ahmed" required />
                  </Field>
                  <div className="form-row">
                    <Field label="Grade">
                      <input name="grade" placeholder="4" required />
                    </Field>
                    <Field label="Section">
                      <input name="section" placeholder="Blue" />
                    </Field>
                  </div>
                  <Field label="Guardian name">
                    <input name="guardianName" placeholder="Parent or guardian" />
                  </Field>
                  <div className="form-row">
                    <Field label="Guardian email">
                      <input name="guardianEmail" placeholder="guardian@example.com" type="email" />
                    </Field>
                    <Field label="Relationship">
                      <input name="guardianRelationship" placeholder="Parent" />
                    </Field>
                  </div>
                  <SubmitButton>Create student</SubmitButton>
                </form>
              </ActionPanel>
            </div>
          </PageSection>
        ) : null}

        <PageSection title="Class Sections">
          {data.classes.length > 0 ? (
            <div className="card-grid compact">
              {data.classes.map((classSection) => (
                <article className="record-card" key={classSection.id}>
                  <div>
                    <strong>{classSection.name}</strong>
                    <span>
                      Grade {classSection.grade}
                      {classSection.subject ? `, ${classSection.subject}` : ""}
                    </span>
                  </div>
                  <StatusPill>{formatCount(classSection.studentCount)} students</StatusPill>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No class sections"
              body="Import or create class sections before assigning schedules, apps, and policies."
            />
          )}
        </PageSection>

        <PageSection title="Students">
          {data.students.length > 0 ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Code</th>
                    <th>Grade</th>
                    <th>Section</th>
                    <th>Guardians</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.students.map((student) => (
                    <tr key={student.id}>
                      <td>{student.name}</td>
                      <td>{student.studentCode}</td>
                      <td>{student.grade}</td>
                      <td>{student.section ?? "Unassigned"}</td>
                      <td>{formatCount(student.guardianCount)}</td>
                      <td>
                        <StatusPill tone={student.status === "ACTIVE" ? "good" : "neutral"}>
                          {humanize(student.status)}
                        </StatusPill>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title="No students in roster"
              body="Validated CSV imports and direct student creation will populate the school roster."
            />
          )}
        </PageSection>
      </div>
    </AppShell>
  );
}

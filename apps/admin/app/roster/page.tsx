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
  bulkCreateClassesAction,
  commitRosterImportAction,
  createClassAction,
  createStudentAction,
  previewRosterImportAction,
  rolloverAcademicYearAction,
} from "../../lib/actions";
import { getAdminData, getRosterImport } from "../../lib/api";
import { formatCount, humanize } from "../../lib/format";

export const dynamic = "force-dynamic";

export default async function RosterPage({
  searchParams,
}: {
  searchParams?: Promise<{ importId?: string }>;
}) {
  const params = await searchParams;
  const data = await getAdminData("/roster");
  const selectedTenant = data.selectedTenant;
  const rosterImport =
    selectedTenant && params?.importId
      ? await getRosterImport(selectedTenant.id, params.importId)
      : { connectionIssue: false, importPreview: null };
  const activeStudents = data.students.filter(
    (student) => student.status === "ACTIVE",
  );

  return (
    <AppShell
      connectionIssue={data.connectionIssue || rosterImport.connectionIssue}
      tenant={selectedTenant}
    >
      <div className="content-stack">
        <PageSection kicker="Academic structure" title="Roster And Classes">
          <section className="stat-grid" aria-label="Roster summary">
            <StatCard
              label="Students"
              value={formatCount(data.students.length)}
            />
            <StatCard
              label="Active students"
              tone="good"
              value={formatCount(activeStudents.length)}
            />
            <StatCard
              label="Classes"
              value={formatCount(data.classes.length)}
            />
            <StatCard
              label="Guardian links"
              value={formatCount(
                data.students.reduce(
                  (total, student) => total + student.guardianCount,
                  0,
                ),
              )}
            />
          </section>
        </PageSection>

        {selectedTenant ? (
          <PageSection kicker="Roster actions" title="Manual Roster Updates">
            <div className="form-grid">
              <ActionPanel title="Create class">
                <form action={createClassAction} className="stacked-form">
                  <input
                    name="tenantId"
                    type="hidden"
                    value={selectedTenant.id}
                  />
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
                  <Field label="Campus ID">
                    <input name="branchId" placeholder="Optional branch ID" />
                  </Field>
                  <Field label="Academic year">
                    <input name="academicYear" placeholder="2026-27" />
                  </Field>
                  <SubmitButton>Create class</SubmitButton>
                </form>
              </ActionPanel>

              <ActionPanel title="Academic year rollover">
                <form
                  action={rolloverAcademicYearAction}
                  className="stacked-form"
                >
                  <input
                    name="tenantId"
                    type="hidden"
                    value={selectedTenant.id}
                  />
                  <Field label="Source academic year">
                    <input
                      name="sourceAcademicYear"
                      placeholder="2025-26"
                      required
                    />
                  </Field>
                  <Field label="Target academic year">
                    <input
                      name="targetAcademicYear"
                      placeholder="2026-27"
                      required
                    />
                  </Field>
                  <Field label="Reason">
                    <input name="reason" placeholder="End-of-year rollover" />
                  </Field>
                  <p className="form-help">
                    Archives all active source-year classes and creates linked
                    empty class structures for the target year.
                  </p>
                  <SubmitButton>Archive and duplicate</SubmitButton>
                </form>
              </ActionPanel>

              <ActionPanel title="Import class sections">
                <form action={bulkCreateClassesAction} className="stacked-form">
                  <input
                    name="tenantId"
                    type="hidden"
                    value={selectedTenant.id}
                  />
                  <Field label="CSV file">
                    <input name="csvFile" accept=".csv,text/csv" type="file" />
                  </Field>
                  <Field label="CSV rows">
                    <textarea
                      name="csv"
                      placeholder="name,grade,subject,branchId"
                    />
                  </Field>
                  <p className="form-help">
                    Import class sections before assigning policies, apps, and
                    schedules to class scopes.
                  </p>
                  <a className="small-button" href="/roster/classes-sample.csv">
                    Download classes sample CSV
                  </a>
                  <SubmitButton>Import classes</SubmitButton>
                </form>
              </ActionPanel>

              <ActionPanel title="Create student">
                <form action={createStudentAction} className="stacked-form">
                  <input
                    name="tenantId"
                    type="hidden"
                    value={selectedTenant.id}
                  />
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
                    <input
                      name="guardianName"
                      placeholder="Parent or guardian"
                    />
                  </Field>
                  <div className="form-row">
                    <Field label="Guardian email">
                      <input
                        name="guardianEmail"
                        placeholder="guardian@example.com"
                        type="email"
                      />
                    </Field>
                    <Field label="Relationship">
                      <input name="guardianRelationship" placeholder="Parent" />
                    </Field>
                  </div>
                  <SubmitButton>Create student</SubmitButton>
                </form>
              </ActionPanel>

              <ActionPanel title="Preview CSV import">
                <form
                  action={previewRosterImportAction}
                  className="stacked-form"
                >
                  <input
                    name="tenantId"
                    type="hidden"
                    value={selectedTenant.id}
                  />
                  <Field label="Filename">
                    <input name="filename" placeholder="grade-4-roster.csv" />
                  </Field>
                  <Field label="CSV file">
                    <input name="csvFile" accept=".csv,text/csv" type="file" />
                  </Field>
                  <Field label="CSV rows">
                    <textarea
                      name="csv"
                      placeholder="studentCode,name,grade,section,status,guardianName,guardianEmail,className"
                    />
                  </Field>
                  <p className="form-help">
                    Upload a CSV file or paste rows to validate students,
                    guardians, classes, and memberships before committing roster
                    changes.
                  </p>
                  <a className="small-button" href="/roster/sample.csv">
                    Download sample CSV
                  </a>
                  <SubmitButton>Validate import</SubmitButton>
                </form>
              </ActionPanel>
            </div>
          </PageSection>
        ) : null}

        {selectedTenant && rosterImport.importPreview ? (
          <PageSection kicker="Import preview" title="CSV Validation Result">
            <div className="import-summary">
              <StatCard
                label="Rows"
                value={formatCount(rosterImport.importPreview.totalRows)}
              />
              <StatCard
                label="Valid"
                tone="good"
                value={formatCount(rosterImport.importPreview.validRows)}
              />
              <StatCard
                label="Errors"
                tone={
                  rosterImport.importPreview.errorRows > 0 ? "critical" : "good"
                }
                value={formatCount(rosterImport.importPreview.errorRows)}
              />
              <div className="action-panel">
                <h3>Commit controls</h3>
                <div className="row-actions left">
                  <form
                    action={commitRosterImportAction}
                    className="button-form"
                  >
                    <input
                      name="tenantId"
                      type="hidden"
                      value={selectedTenant.id}
                    />
                    <input
                      name="importId"
                      type="hidden"
                      value={rosterImport.importPreview.id}
                    />
                    <button
                      className="submit-button"
                      disabled={rosterImport.importPreview.errorRows > 0}
                      type="submit"
                    >
                      Commit valid import
                    </button>
                  </form>
                  <a
                    className="small-button"
                    href={`/roster/import-errors.csv?importId=${rosterImport.importPreview.id}`}
                  >
                    Download error CSV
                  </a>
                </div>
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Row</th>
                    <th>Student</th>
                    <th>Grade</th>
                    <th>Class</th>
                    <th>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {rosterImport.importPreview.rows.slice(0, 12).map((row) => (
                    <tr key={row.rowNumber}>
                      <td>{row.rowNumber}</td>
                      <td>{row.input.name}</td>
                      <td>{row.input.grade}</td>
                      <td>{row.input.className ?? "Not assigned"}</td>
                      <td>
                        {row.errors.length > 0 ? (
                          <>
                            <StatusPill tone="critical">Rejected</StatusPill>
                            <span className="cell-note">
                              {row.errors.join("; ")}
                            </span>
                          </>
                        ) : (
                          <StatusPill tone="good">
                            {humanize(row.action)}
                          </StatusPill>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
                      {classSection.academicYear
                        ? ` · ${classSection.academicYear}`
                        : ""}
                    </span>
                  </div>
                  <StatusPill
                    tone={
                      classSection.status === "ARCHIVED" ? "neutral" : "good"
                    }
                  >
                    {classSection.status === "ARCHIVED"
                      ? "Archived"
                      : `${formatCount(classSection.studentCount)} students`}
                  </StatusPill>
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
                        <StatusPill
                          tone={
                            student.status === "ACTIVE" ? "good" : "neutral"
                          }
                        >
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

# Roster CSV Imports

Phase 1 supports a two-step roster import workflow: preview first, then commit. The preview is persisted so admins can review validation results and download a CSV error report before any student records are created.

## CSV Columns

Required:

- `studentCode`
- `name`
- `grade`

Optional:

- `section`
- `status`
- `branchId`
- `guardianName`
- `guardianEmail`
- `guardianPhone`
- `guardianRelationship`
- `className`
- `classSubject`

Supported student statuses:

- `ACTIVE`
- `PENDING`
- `SUSPENDED`
- `GRADUATED`
- `WITHDRAWN`

## Endpoints

- `POST /api/v1/tenants/:tenantId/roster-imports/preview`
  - Requires `roster:manage`.
  - Body: `{ "filename": "students.csv", "csv": "..." }`.
  - Validates required fields, duplicate student codes, existing tenant student codes, branch ids, student status, and guardian email shape.
- `GET /api/v1/tenants/:tenantId/roster-imports/:importId`
  - Requires `roster:manage`.
  - Returns the stored preview rows and validation errors.
- `GET /api/v1/tenants/:tenantId/roster-imports/:importId/error-report.csv`
  - Requires `roster:manage`.
  - Downloads validation errors as CSV.
- `POST /api/v1/tenants/:tenantId/roster-imports/:importId/commit`
  - Requires `roster:manage`.
  - Commits only imports with zero validation errors and `PREVIEWED` status.

## Commit Behavior

For each valid row:

- Creates one student.
- Creates one guardian link if `guardianName` is provided.
- Creates or reuses a class section if `className` is provided.
- Creates a class membership when a class is present.

The commit step changes the import status to `COMMITTED` and cannot be run twice.

## Audit Events

- `roster_import.preview`
- `roster_import.commit`

Preview audit records total, valid, and error row counts. Commit audit records created student, guardian, class, and membership counts.

## Regression Cases

- Missing required headers are rejected.
- Duplicate student codes in the CSV are rejected in preview.
- Existing tenant student codes are rejected in preview.
- Invalid branch ids are rejected in preview.
- Invalid guardian emails are rejected in preview.
- Imports with errors cannot be committed.
- Committed imports cannot be committed again.
- Error report CSV includes row number, student code, name, grade, and validation errors.
- Successful commit creates students and writes an audit event.

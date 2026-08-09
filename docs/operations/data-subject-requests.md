# Governed data-subject requests

The Privacy page supports tenant-scoped `EXPORT` and `DELETE` requests for student, guardian, and staff records. The requester records the verified subject record ID, purpose, and any active retention deadline. A different authenticated administrator with `tenant:update` must approve or reject the request; self-approval fails closed.

Approved exports persist an immutable JSON snapshot and SHA-256 checksum. Approved deletion requests anonymize the core subject record and remove matching privacy-acceptance records while preserving referential history. They are recorded as `BLOCKED` without changing subject data whenever a declared retention deadline remains active or an unreleased legal hold matches the tenant, subject type, and subject ID.

Legal holds are managed through the tenant-scoped `/api/v1/tenants/:tenantId/privacy/legal-holds` endpoints. Creating and releasing a hold requires `tenant:update`; listing holds and requests and downloading completed exports requires `audit:read`. Audit events deliberately retain the operation, subject type, result counts, checksum, and reason length—not exported subject content, request prose, or erased personal fields.

Operators should verify identity outside the product before opening a request, document only the minimum necessary reason, set applicable retention obligations, use a legal hold while litigation or investigation requires preservation, and have a second authorized administrator review the scope before approval.

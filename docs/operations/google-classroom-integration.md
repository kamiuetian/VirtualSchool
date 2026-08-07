# Google Classroom integration

School admins configure Google Classroom from **Integrations**. Authorization stores only an `arn:`, `vault://`, or `secret://` reference; the referenced Google service-account credential must support domain-wide delegation and the delegated admin must have access to the selected courses.

Course mappings are tenant-unique and connect one Virtual School class to one Classroom course. Roster and material sync are opt-in per mapping. Identity mappings explicitly connect a local student or teacher to a Classroom user and are validated within the current tenant.

Starting a sync creates a tenant-scoped queued run containing only the selected mappings and data types. The integration worker records `SUCCEEDED` or `FAILED`, a privacy-limited outcome count, and a retry-safe error code/message. Only failed runs can be retried; retries preserve the original selection and increment the attempt. Authorization, mapping, queue, and retry operations are audit logged.

Configure `CLASSROOM_SYNC_PROVIDER_URL` for the bounded Classroom adapter endpoint and optionally `CLASSROOM_SYNC_PROVIDER_TOKEN` for its bearer credential. The worker passes the credential reference, delegated administrator, selected course mappings, mapped identities, and requested data types; the adapter resolves the secret and calls Google Classroom. `WORKER_CLASSROOM_SYNC_INTERVAL_MS` controls the polling interval (default 60 seconds).

Operational credentials must never be pasted into the admin UI, logs, database, or repository. Rotate the secret-manager value without changing its reference. Disable the connection or revoke the delegated credential in Google Workspace to stop access during incident response.

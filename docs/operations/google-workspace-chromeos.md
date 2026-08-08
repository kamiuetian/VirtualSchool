# Google Workspace and ChromeOS integration

Tenant administrators configure the connector from **Admin > Integrations > Google Workspace**. Store the service-account JSON in the deployment secret manager and enter only an `arn:`, `vault://`, or `secret://` reference. Configure Google Admin domain-wide delegation for the delegated administrator and the least-privilege Chrome Management read scopes.

Map each Google organizational unit before importing devices. An optional Virtual School branch mapping is copied onto imported inventory and is tenant checked. Inventory ingestion rejects unknown or disabled organizational units, duplicate external IDs or serial numbers, and batches over 500 devices.

The connector-facing endpoint is `POST /tenants/{tenantId}/integrations/google-workspace/inventory`. Each record supplies the Chrome device ID, serial number, organizational unit, model/OS metadata, and one of `SUPPORTED`, `PARTIAL`, `UNSUPPORTED`, or `UNKNOWN` for kiosk, managed guest/session, app and extension, and web-policy status. The API upserts the unified device inventory with provider `GOOGLE_CHROME_ENTERPRISE`; it does not imply support when Google has not reported it.

Authorization, organizational-unit mapping, and inventory imports are audited. Rotate the referenced secret in the secret manager, then reauthorize to record validation. Do not paste private keys into the admin UI or API.

# Microsoft Intune for Education integration

Tenant administrators configure the connector under **Admin > Integrations > Microsoft Intune for Education**. Register a Microsoft Entra application with the least-privilege Microsoft Graph permissions required to read managed devices, groups, Autopilot identities, detected application deployment state, and relevant device configuration state. Store its client secret or certificate in the deployment secret manager and enter only an `arn:`, `vault://`, or `secret://` reference.

Map each permitted Microsoft Entra device group before inventory ingestion. A mapping may optionally route devices to a tenant branch. The API rejects devices from unmapped or disabled groups, duplicate external IDs or serial numbers within a batch, batches over 500 devices, and group or branch mappings outside the tenant.

Inventory sync writes Windows devices into unified inventory with connector `MICROSOFT_INTUNE`. It records Microsoft-reported management health plus explicit `SUPPORTED`, `PARTIAL`, `UNSUPPORTED`, or `UNKNOWN` states for kiosk configuration, secure assessment, Windows Autopilot, and application deployment. Unknown or unsupported values remain visible and are never inferred as supported.

Authorization, group mapping, and inventory ingestion require `tenant:update` and create tenant-scoped audit events. Rotate credentials in the secret manager, update the reference if necessary, and reauthorize. Never place Microsoft credentials in source control, logs, or API payloads other than the external reference.

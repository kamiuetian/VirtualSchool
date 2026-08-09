# Apple School Manager and external iPadOS MDM

Tenant administrators configure this connector under **Admin > Integrations > Apple School Manager and external MDM**. Create or select an MDM server in Apple School Manager, assign devices through Automated Device Enrollment (ADE), and upload the server token and Apple push certificate to the deployment secret manager. The application accepts only an `arn:`, `vault://`, or `secret://` reference; never paste token or certificate contents into the UI.

Record both expiry dates during setup. The integration displays a renewal warning during the final 30 days and after expiry. Renew the material in the secret manager without changing its reference, then submit the updated expiry dates. Keep emergency renewal ownership and the Apple School Manager administrator account documented outside this repository.

The inventory ingestion endpoint is intended for a trusted external-MDM adapter. It reports ADE assignment, supervision, restriction mapping, app/book deployment, and managed-configuration status explicitly as `SUPPORTED`, `PARTIAL`, `UNSUPPORTED`, or `UNKNOWN`. It does not infer support from the device model. Batches are tenant-scoped, limited to 500 unique device IDs and serial numbers, and audited without storing Apple credentials.

# Android Enrollment Guide

Phase 1 uses school-owned Android tablets enrolled through Android Management API.

Enrollment flow:

1. IT admin creates an enrollment batch.
2. The platform generates enrollment token metadata and QR codes.
3. A supported Android tablet is factory-reset or started from a clean setup state.
4. The device is enrolled through the QR flow.
5. The device appears in inventory.
6. Unassigned devices remain quarantined.
7. IT admin assigns the device to a tenant, student, class, device group, and policy.
8. The device receives baseline policy, launcher, secure browser, and approved apps.

Do not sell unsupported models before they are added to the compatibility matrix.

## Phase 1 API Workflow

The first implementation slice supports the administrative enrollment workflow before the
live Android Management API connector is wired in.

1. Create a batch with `POST /api/v1/tenants/{tenantId}/enrollment-batches`.
2. Render the returned `qrPayload` as the batch QR source once the connector supplies the final Google provisioning fields.
3. Record the first managed tablet callback with `POST /api/v1/tenants/{tenantId}/devices/check-ins`.
4. Confirm the response has `quarantined: true` for unassigned devices.
5. Review inventory with `GET /api/v1/tenants/{tenantId}/devices`.
6. Assign the tablet with `POST /api/v1/tenants/{tenantId}/devices/{deviceId}/assignments`.
7. Confirm the onboarding checklist marks enrollment batch and first device enrolled as complete.

New devices must stay in `PENDING` quarantine until an admin assigns them to a branch,
student, class, or device group. Duplicate serial numbers with conflicting enrollment IDs
are rejected so a device cannot be silently re-bound during pilot operations.

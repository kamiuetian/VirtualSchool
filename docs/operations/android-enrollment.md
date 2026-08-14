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

## Live Android Management API Workflow

Enrollment batches are backed by Google Android Management API enrollment tokens. The API
must run with Application Default Credentials that have the `Android Management User` role,
`MDM_CONNECTOR_MODE=android-management`, and a configured
`ANDROID_MANAGEMENT_ENTERPRISE_ID`.

1. Create a batch with `POST /api/v1/tenants/{tenantId}/enrollment-batches`.
2. The API ensures the enterprise has a safe default policy when the tenant has no published
   Google policy, then calls `enterprises.enrollmentTokens.create`.
3. Render the returned `qrCode` string directly as the QR source. Do not stringify, rebuild,
   or edit the Google payload.
4. The token defaults to 24 hours. Override the default with
   `ANDROID_ENROLLMENT_TOKEN_TTL_SECONDS` or provide a future batch expiration.
5. Tokens for one-device batches are one-time-only. Multi-device batches are revoked when
   their internal capacity is reached.
6. Revoke an exposed or unused batch with
   `POST /api/v1/tenants/{tenantId}/enrollment-batches/{batchId}/revoke`.
7. Record the first managed tablet callback with `POST /api/v1/tenants/{tenantId}/devices/check-ins`.
8. Confirm the response has `quarantined: true` for unassigned devices.
9. Review inventory with `GET /api/v1/tenants/{tenantId}/devices`.
10. Assign the tablet with `POST /api/v1/tenants/{tenantId}/devices/{deviceId}/assignments`.
11. Confirm the onboarding checklist marks enrollment batch and first device enrolled as complete.
12. Fetch the enforced launcher/browser payload with `GET /api/v1/tenants/{tenantId}/policies/devices/{deviceId}/payload`.

The provider token resource name is stored for lifecycle operations. Raw token values and QR
payloads must never be written to audit events, logs, documentation, or Git. Legacy batches
created before the live connector do not display a QR and must be revoked and recreated.

## Real-device verification

1. Use a supported Android 7+ device that is new or factory-reset.
2. Tap the same place on the welcome screen six times to open the QR scanner.
3. Connect to a trusted setup network and scan a newly generated batch QR.
4. Confirm Android Device Policy downloads and completes fully-managed, userless setup.
5. Confirm the Google enterprise creates a device resource and the Virtual School portal
   receives the device check-in before assigning it to a student, class, and campus.

New devices must stay in `PENDING` quarantine until an admin assigns them to a branch,
student, class, or device group. Duplicate serial numbers with conflicting enrollment IDs
are rejected so a device cannot be silently re-bound during pilot operations.

The device policy payload includes the winning policy version, precedence explanation,
approved app packages, web shortcuts, browser allow/block rules, restrictions, and
last-known-policy cache guidance for short connectivity interruptions.

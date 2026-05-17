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

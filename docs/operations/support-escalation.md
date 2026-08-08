# Support Escalation Guide

## Ticket priority and SLA

All new support work is recorded as a tenant-scoped ticket. Staff and assigned teachers can link a ticket to a device, student, class, or live session; guardian requests are routed to `GUARDIAN_SUPPORT`, and automation-created tickets are routed to `DEVICE_OPERATIONS`. Privacy and enrollment categories route to their specialist queues. The default initial-response targets are `URGENT` 4 hours, `HIGH` 8 hours, `NORMAL` 24 hours, and `LOW` 72 hours.

Assigning a ticket or moving it to `IN_PROGRESS` records the first response. Resolution and closure record the completion time. Status, priority, assignee, routing, and scoped-note changes are retained in the tenant audit trail. Teachers are limited to tickets for their assigned classes, and `INTERNAL` notes must not be exposed to guardians or other external users.

## Legacy note severity

| Severity | Definition                                                                               | Initial response target |
| -------- | ---------------------------------------------------------------------------------------- | ----------------------- |
| S1       | Platform outage, enrollment outage, or policy enforcement failure affecting many devices | 1 hour                  |
| S2       | Single school blocked from operating classes or device commands                          | 4 hours                 |
| S3       | Individual device, import, report, or app deployment issue                               | 1 business day          |
| S4       | Documentation, training, or enhancement request                                          | 3 business days         |

## Escalation Data

Ticket descriptions and notes should capture:

- Tenant.
- Device serial.
- Student/class where relevant.
- Active mode and policy version.
- Last check-in.
- Command history.
- Error message.
- Troubleshooting steps already attempted.

Tickets are available at `/tenants/:tenantId/support/tickets`; notes are appended below a ticket, and workflow changes use the ticket-specific endpoint. Existing device support-note endpoints remain available for API compatibility and device timelines. Use `SCHOOL` visibility only for notes safe to expose to school staff; keep vendor/internal investigation details as `INTERNAL`.

## Remote assistance

Only staff with device-command permission may start or end remote assistance. Before starting, confirm the device user can see the assistance notice, record the consenting person's name and role or relationship, state the support purpose, and link the relevant ticket when available. Only one active session is allowed per device. End every session with a resolution or handoff note; start and end are tenant-scoped audit events.

Remote assistance guides troubleshooting and exposes management status only. It does not enable hidden camera or microphone access, keystroke capture, private-message inspection, secret screenshots, or covert monitoring. Stop the session if consent is withdrawn. Use the built-in offline-device, failed-app-install, blocked-website, or stuck-kiosk-mode playbook, and follow its escalation step when guided checks do not resolve the issue.

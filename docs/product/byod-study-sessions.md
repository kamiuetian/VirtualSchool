# BYOD study sessions

BYOD study sessions grant temporary access inside the secure browser only. They do not enroll, manage, inspect, or monitor the rest of a student's personal device.

## Eligibility and readiness

Teachers can keep the default class eligibility, apply grade eligibility through the session's class, or bind a session to an active Exam Mode assignment. Exam eligibility is evaluated for the individual student against class, grade, or student assignment scope.

Session creation may restrict supported platforms and browsers and set a minimum browser major version. Defaults allow Android, ChromeOS, iOS, macOS, and Windows with Chrome, Edge, or Safari at major version 100 or newer. Before joining, the student client submits only these transient checks:

- platform and browser family;
- browser major version;
- secure-context availability;
- cookie availability; and
- JavaScript availability.

The API returns bounded readiness issue codes. Raw readiness input and user-agent data are not stored. A join repeats the checks so a readiness response cannot be reused after the environment changes.

## Participation report

Authorized report users can retrieve `GET /tenants/:tenantId/byod-sessions/:sessionId/participation-report`. Each row contains only join time, calculated duration, the session's approved URLs, and exit status. It excludes student identity, authentication subject, consent details, browser data, and activity outside approved session access.

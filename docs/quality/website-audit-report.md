# Virtual School Admin Website Audit

Audit date: 7 August 2026

## Executive summary

The portal is a coherent and functional development candidate: all twelve principal admin routes rendered without a framework error overlay, browser console warning, or browser console error; native required-field validation worked; a create-school submission reached the mock API and reset the form; and teacher permissions correctly hid privileged navigation and redirected a direct request for `/roster`.

The audit found no P0 issue. It found three P1 risks that should be resolved before a multi-school pilot: platform administrators cannot visibly select a tenant, successful and failed mutations do not receive usable in-context feedback, and several consequential operations lack a confirmation/reason guard. Mobile layouts avoid document-level horizontal overflow, but the always-expanded navigation consumes much of the first screen and wide tables put important cells and row actions outside the initial viewport. Content is generally concise, but the test environment presents sample identities and data as if they were authentic, terminology and casing are inconsistent, and specialized controls lack enough guidance.

This was a real-browser audit against the repository's deterministic mock API. Findings about layout, interaction, copy, roles, and presentation are representative. Data persistence, real Auth0, the real API/database, Android Management API side effects, and production error responses remain unverified.

## Environment and method

| Item               | Value                                                                                                |
| ------------------ | ---------------------------------------------------------------------------------------------------- |
| Admin URL          | `http://127.0.0.1:3200`                                                                              |
| Data service       | `apps/admin/tests/mock-api.mjs` on `http://127.0.0.1:4100`                                           |
| Browser            | Codex in-app Chromium browser, real rendered pages                                                   |
| Desktop viewport   | 1440 x 900                                                                                           |
| Mobile viewport    | 390 x 844                                                                                            |
| Roles exercised    | Platform super admin and Teacher                                                                     |
| Console inspection | Warnings and errors captured after route and interaction passes; none observed                       |
| Test data          | Repository fixture: Northview Primary School, TAB001, Sara Ahmed, and related example-domain records |

The flow under test was: sign in -> open every meaningful admin route -> inspect rendered state and content -> exercise validation and a successful mutation -> repeat at mobile width -> sign in as a restricted role -> verify navigation, direct-route handling, and hidden controls.

## Coverage matrix

| Route         | Render/content | Primary controls                                             | Mobile             | Notes                                                                    |
| ------------- | -------------- | ------------------------------------------------------------ | ------------------ | ------------------------------------------------------------------------ |
| `/login`      | Pass           | Sign-in and profile selection exercised                      | Pass               | Development sign-in only                                                 |
| `/`           | Pass           | Read-only dashboard                                          | Pass with findings | Summary, readiness, alerts, billing, enrollment table                    |
| `/tenants`    | Pass           | Native validation and create-school submission exercised     | Pass with findings | Profile, campus, staff import, lifecycle controls inspected              |
| `/roster`     | Pass           | Controls and CSV surfaces inspected                          | Pass with findings | Preview/commit state not exercised in this pass                          |
| `/enrollment` | Pass           | Batch form and QR/download surfaces inspected                | Pass               | QR source is mock fixture                                                |
| `/devices`    | Pass           | Assignment, command, wipe, history and diagnostics inspected | Pass with findings | Teacher sees no privileged command controls                              |
| `/policies`   | Pass           | Template, publish and assignment controls inspected          | Pass with findings | No real MDM publish performed                                            |
| `/timetable`  | Pass           | Create and deactivate controls inspected                     | Pass with findings | Row action is initially off-screen on mobile                             |
| `/apps`       | Pass           | Add/import/deployment controls inspected                     | Pass with findings | Managed Play deployment not performed                                    |
| `/alerts`     | Pass           | Scan, acknowledge and resolve controls inspected             | Pass               | No failure response simulated                                            |
| `/support`    | Pass           | Notes, status, retention preview/apply inspected             | Pass               | Destructive retention apply not submitted                                |
| `/reports`    | Pass           | Export link and three tables inspected                       | Pass with findings | Download content previously covered by repository E2E, not re-saved here |
| `/billing`    | Pass           | Subscription form inspected                                  | Pass               | Real billing integration out of scope                                    |
| Role-aware UI | Pass           | Teacher nav, `/roster` redirect, device controls             | Pass               | Additional six roles not exercised live                                  |

## Prioritized findings

### VS-WEB-001 — P1 — Platform administrators cannot select the active school

**Affected route / likely owner:** Global shell and all tenant-scoped routes; `apps/admin/components/app-shell.tsx`, tenant selection/data-loading layer.

**Reproduction**

1. Sign in as Platform super admin with school scope `*`.
2. Open `/tenants` and observe the tenant directory.
3. Return to the header or another tenant-scoped route.

**Expected:** A platform operator can identify and switch the active school, with the selected tenant carried consistently into every data request.

**Actual:** The element styled as `tenant-switcher` contains only the current school's timezone and is not interactive. The header remains Northview Primary School and there is no visible way to select another listed school.

**Evidence:** DOM inspection found a plain `<div class="tenant-switcher">` with timezone text, not a link, button, or select. Every tested page stayed scoped to `tenant-northview`.

**Action:** Add an accessible tenant picker for multi-tenant roles, retain selection across navigation, prevent inaccessible tenant IDs, show the active school clearly, and add role/tenant E2E coverage.

### VS-WEB-002 — P1 — Mutations lack durable success and recoverable error feedback

**Affected route / likely owner:** All action forms; `apps/admin/lib/actions.ts`, shared form components, route error boundaries.

**Reproduction**

1. Open `/tenants` as Platform super admin.
2. Complete Create school with valid values and submit.
3. Observe the page after the request completes.

**Expected:** The submit control shows progress, duplicate submission is prevented, and a success message identifies the created resource. A failed request should preserve entered values and show a field/form-level recovery message.

**Actual:** On the successful mock response the form silently resets and the unchanged mock list re-renders. No status, toast, confirmation text, or other durable evidence tells the operator whether creation succeeded. Server actions generally await the API and revalidate; failures escalate to a page-level boundary rather than an in-context form result.

**Evidence:** After creating “Lakeside Academy,” the URL remained `/tenants`, all inputs cleared, the directory still contained one school, and no success text or `role=status` result appeared. Console remained clean, so the absence is a UX state problem rather than a runtime failure.

**Action:** Standardize pending, success, validation-error, API-error, and retry states with `useActionState` or an equivalent form pattern. Preserve values on failure and include the affected resource/action in the message.

### VS-WEB-003 — P1 — Consequential actions are one-click operations without adequate safeguards

**Affected route / likely owner:** `/tenants`, `/timetable`, `/alerts`, `/support`; respective page actions and authorization/audit layer.

**Reproduction**

1. Open `/tenants` and inspect a staff member's lifecycle controls.
2. Observe Suspend, Deactivate, Clear MFA, and Force logout.
3. Inspect Deactivate on `/timetable` and Apply cleanup on `/support`.

**Expected:** High-impact or destructive actions explain impact, require an explicit confirmation (and a reason where auditing requires it), prevent accidental double submission, and show the result.

**Actual:** These controls are ordinary submit buttons. Unlike the wipe workflow, they do not consistently require a confirmation phrase, checkbox, or entered reason. “Apply cleanup” is especially ambiguous about which records and counts will be deleted.

**Evidence:** Rendered forms expose enabled buttons immediately. Only device wipe visibly requires serial confirmation and a reason.

**Action:** Introduce a consistent confirmation dialog/panel, impact summary, mandatory reason, dry-run count handoff for retention cleanup, permission re-check, idempotency, and audited completion result.

### VS-WEB-004 — P2 — Mobile navigation occupies most of the first screen and cannot collapse

**Affected route / likely owner:** Every authenticated route; `apps/admin/components/app-shell.tsx`, responsive rules in `apps/admin/app/globals.css`.

**Reproduction**

1. Use a 390 x 844 viewport and sign in as Platform super admin.
2. Open `/reports` or any authenticated route at the top.
3. Measure how much scrolling is required before reaching the route content.

**Expected:** A compact mobile header/menu keeps page identity and the primary task visible near the first viewport, while navigation remains keyboard and screen-reader accessible.

**Actual:** All twelve navigation items are rendered in a two-column, always-expanded block. The shell/header can consume roughly a full viewport before substantive route content. The page has no menu disclosure control.

**Evidence:** Mobile screenshot inspection showed the navigation filling the upper portion of the screen and route content beginning below it. Mobile page heights reached 4,339 px on `/devices` and 4,333 px on `/tenants`.

**Action:** Add an accessible menu disclosure/drawer, keep current-page context visible, lock and restore focus correctly, close on navigation/Escape, and test 320/390/768 px widths.

### VS-WEB-005 — P2 — Wide tables hide columns and actions without a visible overflow cue

**Affected route / likely owner:** `/`, `/tenants`, `/roster`, `/devices`, `/policies`, `/timetable`, `/apps`, `/reports`; table component/CSS.

**Reproduction**

1. Use a 390 px viewport.
2. Open `/timetable` and scroll to Weekly Schedule.
3. Observe the row without horizontally scrolling.

**Expected:** Critical identity, status, and action information remains discoverable, or the UI visibly signals horizontal scrolling and provides an accessible alternative.

**Actual:** Tables enforce a 760 px minimum width inside an overflow container. In `/timetable`, Deactivate begins around x=706 and is completely outside the initial 390 px viewport. Similar clipping affects three tables on `/devices` and three on `/reports`; no gradient, “scroll for more,” sticky action column, or card alternative communicates hidden content.

**Evidence:** Browser geometry measured 760 px tables at a 390 px viewport. The timetable action occupied x=705.8–766.8. Document-level overflow stayed at or below zero, confirming the content is hidden inside the table scroller rather than expanding the page.

**Action:** Use responsive row cards or prioritized/sticky columns, retain table semantics, add an overflow affordance, and ensure actions can be reached by touch and keyboard.

### VS-WEB-006 — P2 — Page heading hierarchy prioritizes the tenant over the current task

**Affected route / likely owner:** Global shell and all pages; `apps/admin/components/app-shell.tsx`, page-section component.

**Reproduction**

1. Open `/devices`.
2. Inspect headings with a screen reader or browser accessibility tree.

**Expected:** “Device Inventory” is the page's unique level-one heading; tenant context is labelled separately.

**Actual:** “Northview Primary School” is the only `h1`; “Device Inventory” and all other sections are `h2`. This makes every tenant-scoped route appear to have the same page heading and weakens navigation by headings.

**Evidence:** Browser evaluation on `/devices` returned `h1: [Northview Primary School]` and `h2: [Device Inventory, Assign Tablet, Command Center, Managed Tablets, Command History, Recent Diagnostics]`.

**Action:** Make the route title the unique `h1`, present school context as labelled metadata, and preserve a logical `h2`/`h3` structure beneath it.

### VS-WEB-007 — P2 — Development/test data is indistinguishable from authentic school data

**Affected route / likely owner:** Global shell, local development authentication, mock/demo data strategy.

**Reproduction**

1. Run the documented local mock environment.
2. Sign in and browse the dashboard, tenant profile, reports, and device details.

**Expected:** Seed/demo environments carry an unmistakable persistent banner and safe fictional-data labeling; production never silently falls back to demo content.

**Actual:** Northview Primary School, staff/student names, TAB001, billing data, alerts, support notes, and `example.edu` addresses are presented as normal operational records. No “Demo,” “Sample data,” or “Test environment” marker appears.

**Evidence:** The live header and reports presented sample fixture values without qualification on all twelve routes. The login also defaulted to `admin@example.edu` and “School Administrator.”

**Action:** Add an environment/data-mode banner driven by explicit configuration, use clearly fictional but respectful fixtures, prohibit demo datasets in production, and document how screenshots should be labeled.

### VS-WEB-008 — P2 — Development sign-in can display a contradictory identity

**Affected route / likely owner:** `/login`; `apps/admin/app/login/page.tsx`, development session UX.

**Reproduction**

1. Open the development login page.
2. Leave Full name at its default “School Administrator.”
3. select Teacher and sign in.

**Expected:** The displayed identity is internally consistent, and the form makes clear that this is a local test persona rather than real authentication.

**Actual:** The header shows name “School Administrator” with role “Teacher” and email `admin@example.edu`. The role changes permissions correctly, but the identity is misleading during role testing and screenshots.

**Evidence:** The teacher role exposed only Overview, Devices, Alerts, and Support; a direct `/roster` request redirected to `/`, while the header simultaneously identified the user as School Administrator.

**Action:** Replace independent free-form identity fields with named test personas, update name/email/scope atomically when the persona changes, and label the entire form “Local development only.”

### VS-WEB-009 — P2 — Required fields and conditional rules are not explained consistently

**Affected route / likely owner:** Most action pages; shared form patterns and domain owners.

**Reproduction**

1. Open `/devices` and inspect Queue device command and Confirmed wipe.
2. Open `/apps`, `/policies`, and `/timetable` and inspect scope/target fields.
3. Compare labels, required state, and instructional copy.

**Expected:** Required fields are visibly marked; conditional inputs state when they apply; acronyms and operational consequences are explained.

**Actual:** HTML `required` exists for some inputs but labels have no required indicator or form legend. “Target ID,” “TTL minutes,” “S1–S4,” scope values, retention periods, and “Preserve factory reset protection” have little or no contextual guidance. The device command Message field says it applies only to message commands but remains generally visible.

**Evidence:** Browser evaluation found required Device, Serial confirmation, and Reason controls on `/devices` with no visible required marker. Native submission validation correctly focused the first invalid school-name field and reported “Please fill out this field,” but users are not told requirements before submitting.

**Action:** Establish shared required/optional conventions, conditionally reveal dependent fields, add concise helper text and examples, define acronyms on first use, and connect help/error text with `aria-describedby`.

### VS-WEB-010 — P3 — Navigation lacks current-page and skip-navigation signals

**Affected route / likely owner:** Global shell; `apps/admin/components/app-shell.tsx`.

**Reproduction**

1. Open `/devices`.
2. Inspect the Primary navigation accessibility tree.
3. Begin keyboard navigation from the top of the page.

**Expected:** The Devices link exposes `aria-current="page"`, and keyboard users can skip directly to main content.

**Actual:** No element has `aria-current`, and no same-page skip link exists. A keyboard user must traverse the full navigation on every route, which is especially costly for the twelve-link privileged menu.

**Evidence:** Browser evaluation returned empty arrays for `[aria-current]` and `a[href^="#"]`; a single semantic `<main>` was present.

**Action:** Mark the active route, add a first-focusable skip link targeting the workspace content, and verify a visible focus indicator at desktop and mobile breakpoints.

### VS-WEB-011 — P3 — Product language and value formatting are inconsistent

**Affected route / likely owner:** All page copy and formatting utilities; content design owner.

**Reproduction**

1. Compare route titles and data values across `/tenants`, `/billing`, `/apps`, `/alerts`, and `/policies`.

**Expected:** Sentence-case headings and labels, consistent human-readable states, and stable domain terminology.

**Actual:** Titles use headline-style “And” (`Roster And Classes`, `Policies And Modes`, `Apps And Web Catalog`, `Alerts And Diagnostics`) while other headings use sentence-like casing. The tenant table shows plan `growth`, the billing card shows `Growth`, and subscription/status areas mix `ACTIVE` with `Active`. “School,” “tenant,” “campus,” and “branch” are used without explaining their hierarchy.

**Evidence:** These variants appeared in the rendered DOM during the route pass; they are not console or data-fetch errors.

**Action:** Create a concise content style guide and shared formatters for statuses, plans, commands, roles, dates, acronyms, and organizational terms; then run a copy consistency pass.

### VS-WEB-012 — P3 — Some control labels are too generic for assistive technology and audit-heavy workflows

**Affected route / likely owner:** `/support` and row-action patterns.

**Reproduction**

1. Open `/support` with a support note selected.
2. Inspect the note status action.

**Expected:** The accessible control name identifies both the action and target, for example “Save status for Incident note, S3.”

**Actual:** The button is named only “Save.” Similar repeated lifecycle actions rely heavily on surrounding visual context.

**Evidence:** The accessibility snapshot exposes `button "Save"` beneath the note, without the target in its accessible name.

**Action:** Give row actions target-specific accessible names, retain concise visible labels if desired, and test repeated controls with a screen reader-oriented locator suite.

## Content audit summary

Strengths include concise dashboard summaries, generally action-oriented button text, descriptive empty-state copy such as “Plan usage is not available,” and consistent use of school/device concepts in most operational flows.

Priority content work is to distinguish demo data, define the school/tenant/campus/branch model, standardize sentence casing and humanized enum values, explain technical options at the point of use, and make destructive-action consequences explicit. Placeholder text is being used as the primary example/help mechanism in many forms; examples should remain visible after entry and should not substitute for instructions.

## Responsive and visual summary

- No tested route produced document-level horizontal overflow greater than two pixels.
- Forms and card grids reliably collapsed to one column at 390 px.
- All wide data tables remained 760 px and required internal horizontal scrolling; hidden row actions are the greatest responsive usability risk.
- The full navigation becomes a two-column block rather than a compact mobile menu, delaying access to page content.
- No broken rendered image was observed. The configured school logo URL was not rendered in the shell, so branded-logo failure and fallback behavior could not be assessed.
- Visual styling was consistent across sections, cards, badges, and action panels. Some pages are extremely long on mobile, increasing context loss between controls and results.

## Interaction and accessibility summary

- Native required-field validation worked and focused the first invalid field.
- Teacher navigation and direct-route restrictions behaved correctly in the flows tested.
- Teacher command controls were absent on `/devices`, not merely disabled.
- No browser console warning or error was captured during route and interaction passes.
- Semantic landmarks (`nav`, `main`, complementary regions), labels, tables, and many region names are present.
- Current-page navigation, skip navigation, visible required conventions, target-specific row action names, and correct route-level heading hierarchy need improvement.
- Focus order, modal focus trapping (no modal exists for destructive actions), screen-reader announcements after mutation, color contrast, zoom at 200–400%, reduced motion, and high-contrast mode were not fully assessed.

## Untested risks

- Real Auth0 login, MFA, logout propagation, expired sessions, invalid claims, and all roles other than Platform super admin and Teacher.
- Real API/database persistence, latency, optimistic concurrency, duplicate submissions, validation payloads, 401/403/404/409/422/429/500 responses, and offline/reconnect behavior.
- True multi-tenant datasets and attempts to cross tenant boundaries.
- Actual MDM publish/deploy/command execution, device wipe, retention deletion, billing changes, and audit-log verification.
- File uploads with malformed, oversized, non-UTF-8, formula-injection, and partially valid CSV data.
- Empty, loading, high-volume, pagination, sorting, filtering, and long localized-string states; the deterministic fixture contains one record in most collections.
- QR download/scan on physical devices, expired batches, image fallback, real school logos, broken external URLs, and browser download permission handling.
- Safari, Firefox, touch-only devices, screen readers, 320 px width, tablet landscape, browser zoom, high contrast, and reduced-motion settings.

## Suggested backlog packaging

To keep implementation cycles independently verifiable, package the findings as: (1) tenant selector and tenant-context persistence; (2) shared mutation-state/error system; (3) destructive-action safety pattern; (4) responsive shell/navigation; (5) responsive data-table pattern; (6) accessibility navigation and heading repair; (7) environment/demo labeling and development personas; and (8) content system and terminology cleanup.

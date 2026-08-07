import { createServer } from "node:http";

const port = Number(process.env.ADMIN_E2E_API_PORT ?? 4100);
const tenantId = "tenant-northview";
const deviceId = "device-tab-001";
const policyId = "policy-supervised";
const appId = "app-classroom";
const importId = "import-preview-1";
const mutationJournal = [];

const now = "2026-05-17T10:00:00.000Z";

const tenant = {
  id: tenantId,
  accentColor: "#f5c65f",
  country: "US",
  logoUrl: "https://assets.example.edu/northview-logo.png",
  name: "Northview Primary School",
  planKey: "growth",
  primaryColor: "#116b5f",
  status: "ACTIVE",
  supportEmail: "support@northview.edu",
  supportPhone: "+1 555 0100",
  timezone: "America/New_York",
  websiteUrl: "https://northview.example.edu",
};

const device = {
  androidVersion: "14",
  branchId: "branch-main",
  classId: "class-4-blue",
  compliance: "COMPLIANT",
  connectorDeviceName: "enterprises/northview/devices/tab-001",
  enrollmentBatchId: "batch-1",
  enrollmentId: "enroll-001",
  health: "GOOD",
  id: deviceId,
  lastCheckInAt: now,
  manufacturer: "Samsung",
  mdmConnector: "ANDROID_MANAGEMENT_API",
  model: "Galaxy Tab A9",
  ownershipType: "SCHOOL_OWNED",
  policyVersion: 3,
  serialNumber: "TAB001",
  status: "ONLINE",
  studentId: "student-sara",
  tags: ["pilot", "grade-4"],
  tenantId,
};

const policy = {
  createdAt: "2026-05-01T08:00:00.000Z",
  id: policyId,
  mdmPublishStatus: "PUBLISHED",
  name: "Grade 4 Supervised Learning",
  rules: {
    approvedAppPackageIds: ["com.google.android.apps.classroom"],
    defaultWebAccess: "DENY",
    launcher: {
      showMessages: true,
      showSupportContact: true,
      webShortcuts: [{ title: "Math Lab", url: "https://math.example.edu" }],
    },
    mode: "SUPERVISED_LEARNING",
    restrictions: {
      blockAppInstall: true,
      blockSafeMode: true,
      blockSettings: true,
    },
    urlAllowlist: ["https://classroom.google.com"],
    urlBlocklist: ["https://video.example.com"],
  },
  status: "PUBLISHED",
  tenantId,
  updatedAt: now,
  version: 3,
};

const draftPolicy = {
  ...policy,
  id: "policy-draft",
  mdmPublishStatus: null,
  name: "Grade 5 Pilot Draft",
  status: "DRAFT",
  version: 1,
};

const app = {
  approvalStatus: "APPROVED",
  approvedGrades: ["4", "5"],
  category: "Learning",
  description: "Classroom workflow app",
  iconUrl: null,
  id: appId,
  installRules: { installType: "FORCE_INSTALLED" },
  name: "Google Classroom",
  packageId: "com.google.android.apps.classroom",
  tenantId,
  updatedAt: now,
};

const students = [
  {
    grade: "4",
    guardianCount: 1,
    id: "student-sara",
    name: "Sara Ahmed",
    section: "Blue",
    status: "ACTIVE",
    studentCode: "S-1001",
    tenantId,
  },
];

const classes = [
  {
    grade: "4",
    id: "class-4-blue",
    name: "Grade 4 Blue",
    studentCount: 24,
    subject: "Science",
    tenantId,
  },
];

const users = [
  {
    auth0Subject: "auth0|school-admin",
    createdAt: "2026-05-01T08:00:00.000Z",
    email: "admin@northview.edu",
    id: "user-admin",
    mfaEnabled: true,
    mfaRequired: true,
    name: "Aisha Khan",
    role: "SCHOOL_ADMIN",
    status: "ACTIVE",
    tenantId,
    updatedAt: now,
  },
];

const alerts = [
  {
    createdAt: now,
    firstSeenAt: now,
    id: "alert-offline",
    lastSeenAt: now,
    message: "Tablet has not checked in within the configured threshold.",
    severity: "WARNING",
    source: "SYSTEM",
    status: "OPEN",
    tenantId,
    title: "Device offline",
    type: "DEVICE_OFFLINE",
    updatedAt: now,
    deviceId,
  },
];

const rosterImport = {
  committedAt: null,
  committedBy: null,
  createdAt: now,
  createdBy: "admin-portal",
  errorRows: 1,
  filename: "grade-4-roster.csv",
  id: importId,
  rows: [
    {
      action: "CREATE_STUDENT",
      errors: [],
      input: {
        className: "Grade 4 Blue",
        grade: "4",
        guardianEmail: "guardian@example.com",
        guardianName: "Fatima Ahmed",
        name: "Sara Ahmed",
        section: "Blue",
        status: "ACTIVE",
        studentCode: "S-1001",
      },
      rowNumber: 2,
    },
    {
      action: "REJECT",
      errors: ["studentCode is required"],
      input: {
        className: "Grade 4 Blue",
        grade: "4",
        name: "Missing Code",
        section: "Blue",
      },
      rowNumber: 3,
    },
  ],
  status: "PREVIEWED",
  tenantId,
  totalRows: 2,
  validRows: 1,
};

function json(response, status = 200) {
  return {
    body: JSON.stringify(response),
    headers: { "content-type": "application/json; charset=utf-8" },
    status,
  };
}

function text(body, contentType = "text/plain; charset=utf-8", status = 200) {
  return {
    body,
    headers: { "content-type": contentType },
    status,
  };
}

let teacherSessionActive = false;

const routes = [
  ["GET", "/tenants", () => json([tenant])],
  [
    "GET",
    `/tenants/${tenantId}/onboarding-checklist`,
    () =>
      json({
        completedAt: null,
        completedCount: 7,
        items: [
          ["school_profile", "School profile complete", "/tenants"],
          ["branch_created", "Branch or campus created", "/tenants"],
          ["roster_started", "Roster started", "/roster"],
          ["policy_template_created", "Policy published", "/policies"],
          ["app_catalog_configured", "App catalog configured", "/apps"],
          [
            "enrollment_batch_generated",
            "Enrollment batch generated",
            "/enrollment",
          ],
          ["first_device_enrolled", "First device enrolled", "/enrollment"],
        ].map(([key, label, href]) => ({
          completed: true,
          description: `Guidance for ${label}.`,
          href,
          key,
          label,
        })),
        readinessIssues: [],
        readyForFirstEnrollment: true,
        tenantId,
        totalCount: 7,
      }),
  ],
  ["GET", `/tenants/${tenantId}/devices`, () => json([device])],
  [
    "GET",
    `/tenants/${tenantId}/teacher/dashboard`,
    () =>
      json({
        classes: [
          {
            id: "class-4a",
            name: "Grade 4A",
            grade: "4",
            subject: "Mathematics",
            deviceCount: 1,
          },
        ],
        devices: [{ ...device, classId: "class-4a" }],
        activeSession: teacherSessionActive
          ? { id: "session-1", classId: "class-4a", className: "Grade 4A", teacherId: "teacher-1", status: "ACTIVE", startedAt: now, endedAt: null, reason: null, events: [] }
          : null,
        recentSessions: [],
        templates: [],
        approvedResources: [{ id: "app-1", name: "School Reader", packageId: "edu.example.reader", category: "READING" }],
      }),
  ],
  [
    "GET",
    `/tenants/${tenantId}/privacy/notices`,
    () =>
      json([
        {
          id: "notice-1",
          tenantId,
          noticeType: "GENERAL_PRIVACY",
          channel: "WEB",
          version: 1,
          title: "School privacy notice",
          content: "How the school handles managed-device information.",
          publishedBy: "admin-1",
          publishedAt: now,
        },
      ]),
  ],
  ["GET", `/tenants/${tenantId}/privacy/acceptances`, () => json([])],
  [
    "GET",
    `/tenants/${tenantId}/reports/device-inventory`,
    () =>
      json({
        byCompliance: { COMPLIANT: 1 },
        byHealth: { GOOD: 1 },
        devices: [device],
        generatedAt: now,
        tenantId,
        totals: {
          devices: 1,
          locked: 0,
          nonCompliant: 0,
          offline: 0,
          online: 1,
          pending: 0,
        },
      }),
  ],
  [
    "GET",
    `/tenants/${tenantId}/reports/device-inventory.csv`,
    () =>
      text(
        '"device_id","serial_number","status"\n"device-tab-001","TAB001","ONLINE"\n',
        "text/csv; charset=utf-8",
      ),
  ],
  ["GET", `/tenants/${tenantId}/alerts`, () => json(alerts)],
  [
    "GET",
    `/tenants/${tenantId}/notifications/preferences`,
    () =>
      json({
        appFailureEnabled: true,
        deduplicationWindowMinutes: 60,
        lostDeviceEnabled: true,
        offlineAfterMinutes: 60,
        offlineEnabled: true,
        policyFailureEnabled: true,
        recipients: ["it@northview.edu"],
        repeatedEnrollmentEnabled: true,
        repeatedEnrollmentThreshold: 3,
        tenantId,
        updatedAt: now,
        updatedBy: "user-admin",
      }),
  ],
  ["GET", `/tenants/${tenantId}/notifications/deliveries`, () => json([])],
  [
    "GET",
    `/tenants/${tenantId}/devices/${deviceId}/history`,
    () =>
      json({
        assignments: [
          {
            id: "device-assignment-1",
            studentId: "student-001",
            classId: "class-4-blue",
            branchId: "branch-main",
            reason: "Pilot allocation",
            startedAt: now,
            endedAt: null,
          },
        ],
        lifecycle: [],
      }),
  ],
  [
    "GET",
    `/tenants/${tenantId}/enrollment-batches`,
    () =>
      json([
        {
          createdAt: now,
          enrolledCount: 1,
          expiresAt: "2026-06-17T10:00:00.000Z",
          id: "batch-1",
          maxDevices: 50,
          name: "Pilot tablets",
          qrPayload: { token: "token-1" },
          status: "ACTIVE",
          tenantId,
          token: "token-1",
        },
      ]),
  ],
  ["GET", `/tenants/${tenantId}/policies`, () => json([policy, draftPolicy])],
  [
    "GET",
    `/tenants/${tenantId}/policies/assignments`,
    () =>
      json([
        {
          active: true,
          id: "assignment-1",
          policyId,
          policyName: policy.name,
          policyVersion: 3,
          scope: "CLASS",
          scopeId: "class-4-blue",
          tenantId,
        },
      ]),
  ],
  [
    "GET",
    `/tenants/${tenantId}/reports/policy-deployments`,
    () =>
      json({
        generatedAt: now,
        policies: [
          {
            activeAssignmentCount: 1,
            assignmentCount: 1,
            failedDeploymentCount: 0,
            name: policy.name,
            policyId,
            queuedDeploymentCount: 1,
            status: "PUBLISHED",
            updatedAt: now,
            version: 3,
          },
        ],
        tenantId,
        totals: {
          activeAssignments: 1,
          draft: 0,
          failedDeployments: 0,
          policies: 1,
          published: 1,
          queuedDeploymentCommands: 1,
        },
      }),
  ],
  ["GET", `/tenants/${tenantId}/apps`, () => json([app])],
  [
    "GET",
    `/tenants/${tenantId}/policies/events/blocked-domains/aggregates`,
    () => json([]),
  ],
  [
    "GET",
    `/tenants/${tenantId}/reports/app-deployments`,
    () =>
      json({
        apps: [
          {
            appId,
            approvalStatus: "APPROVED",
            approvedGrades: ["4", "5"],
            assignedPolicyCount: 1,
            category: "Learning",
            failedDeploymentCount: 0,
            name: app.name,
            packageId: app.packageId,
            policyNames: [policy.name],
            queuedCommandCount: 1,
            updatedAt: now,
          },
        ],
        generatedAt: now,
        tenantId,
        totals: {
          apps: 1,
          approved: 1,
          assignedApps: 1,
          blocked: 0,
          failedDeployments: 0,
          queuedCommands: 1,
        },
      }),
  ],
  ["GET", `/tenants/${tenantId}/students`, () => json(students)],
  ["GET", `/tenants/${tenantId}/classes`, () => json(classes)],
  ["GET", `/tenants/${tenantId}/calendar-exceptions`, () => json([])],
  ["GET", `/tenants/${tenantId}/users`, () => json(users)],
  [
    "GET",
    `/tenants/${tenantId}/timetable-blocks`,
    () =>
      json([
        {
          active: true,
          createdAt: now,
          dayOfWeek: 1,
          endMinute: 600,
          id: "block-math",
          name: "Grade 4 Mathematics",
          policyId,
          policyName: policy.name,
          policyVersion: 3,
          scope: "CLASS",
          scopeId: "class-4-blue",
          startMinute: 540,
          subject: "Mathematics",
          tenantId,
          timezone: tenant.timezone,
          updatedAt: now,
        },
      ]),
  ],
  [
    "GET",
    `/tenants/${tenantId}/retention-settings`,
    () =>
      json({
        auditRetentionDays: 1095,
        commandHistoryRetentionDays: 365,
        createdAt: now,
        diagnosticRetentionDays: 180,
        exportArtifactRetentionDays: 30,
        id: "retention-1",
        resolvedAlertRetentionDays: 365,
        supportNoteRetentionDays: 730,
        tenantId,
        updatedAt: now,
      }),
  ],
  [
    "GET",
    `/tenants/${tenantId}/billing/usage`,
    () =>
      json({
        metrics: [
          {
            key: "devices",
            label: "Devices",
            limit: 500,
            overLimit: false,
            percentUsed: 1,
            used: 5,
          },
          {
            key: "students",
            label: "Students",
            limit: 1000,
            overLimit: false,
            percentUsed: 2,
            used: 24,
          },
          {
            key: "staffUsers",
            label: "Staff users",
            limit: 100,
            overLimit: false,
            percentUsed: 1,
            used: 1,
          },
          {
            key: "commandsPerBillingPeriod",
            label: "Commands this billing period",
            limit: 25000,
            overLimit: false,
            percentUsed: 1,
            used: 30,
          },
        ],
        plan: {
          key: "growth",
          limits: {
            branches: 10,
            commandsPerBillingPeriod: 25000,
            devices: 500,
            staffUsers: 100,
            students: 1000,
          },
          name: "Growth",
        },
        subscription: {
          billingEmail: "billing@northview.edu",
          billingPeriodEnd: "2026-06-17T10:00:00.000Z",
          billingPeriodStart: "2026-05-17T10:00:00.000Z",
          createdAt: now,
          id: "sub-1",
          overrides: {},
          planKey: "growth",
          status: "ACTIVE",
          tenantId,
          trialEndsAt: null,
          updatedAt: now,
        },
        tenantId,
        totals: { overLimitCount: 0, warningCount: 0 },
      }),
  ],
  [
    "GET",
    `/tenants/${tenantId}/support/devices/${deviceId}/notes`,
    () =>
      json([
        {
          authorEmail: "support@northview.edu",
          authorId: "user-admin",
          body: "Battery health reviewed after classroom report.",
          category: "INCIDENT",
          createdAt: now,
          deviceId,
          id: "note-1",
          pinned: true,
          severity: "S3",
          status: "OPEN",
          tenantId,
          updatedAt: now,
          visibility: "INTERNAL",
        },
      ]),
  ],
  [
    "GET",
    `/tenants/${tenantId}/support/devices/${deviceId}/timeline`,
    () =>
      json([
        {
          deviceId,
          id: "timeline-1",
          metadata: {},
          occurredAt: now,
          summary: "LOCK command executed by support.",
          tenantId,
          title: "Remote lock",
          type: "REMOTE_COMMAND",
        },
      ]),
  ],
  [
    "GET",
    `/tenants/${tenantId}/devices/${deviceId}/commands`,
    () =>
      json([
        {
          attempts: 1,
          createdAt: now,
          deviceId,
          id: "command-1",
          maxAttempts: 3,
          reason: "Classroom support",
          status: "EXECUTED",
          tenantId,
          type: "POLICY_REFRESH",
          updatedAt: now,
        },
      ]),
  ],
  [
    "GET",
    `/tenants/${tenantId}/devices/${deviceId}/diagnostics`,
    () =>
      json([
        {
          batteryLevel: 82,
          compliance: "COMPLIANT",
          createdAt: now,
          deviceId,
          health: "GOOD",
          id: "diagnostic-1",
          networkStatus: "WIFI",
          reportedAt: now,
          storageFreeMb: 12400,
          tenantId,
        },
      ]),
  ],
  [
    "GET",
    `/tenants/${tenantId}/roster-imports/${importId}`,
    () => json(rosterImport),
  ],
  [
    "GET",
    `/tenants/${tenantId}/roster-imports/${importId}/error-report.csv`,
    () =>
      text(
        '"row","errors"\n"3","studentCode is required"\n',
        "text/csv; charset=utf-8",
      ),
  ],
];

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host}`);
  const pathname = url.pathname;

  if (request.method === "GET" && pathname === "/__test/mutations") {
    response.writeHead(200, {
      "content-type": "application/json; charset=utf-8",
    });
    response.end(JSON.stringify(mutationJournal));
    return;
  }

  if (request.method !== "GET") {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const rawBody = Buffer.concat(chunks).toString("utf8");
    let body = rawBody;
    try {
      body = rawBody ? JSON.parse(rawBody) : {};
    } catch {
      // Retain the raw payload to make unexpected request formats diagnosable.
    }
    mutationJournal.push({ body, method: request.method, path: pathname });
    if (request.method === "POST" && pathname === `/tenants/${tenantId}/teacher/sessions`) teacherSessionActive = true;
    response.writeHead(201, {
      "content-type": "application/json; charset=utf-8",
    });
    response.end(
      JSON.stringify(
        pathname.endsWith("/simulate-url")
          ? {
              decision: "BLOCKED",
              effectiveAccess: "DENY",
              matchedRule: "https://blocked.example/*",
              policyId,
              policyVersion: 3,
              reason: "BLOCKLIST",
              url: body.url,
            }
          : pathname.endsWith("/roster-imports/preview")
            ? rosterImport
            : { ok: true, id: "mutation-ok" },
      ),
    );
    return;
  }

  const match = routes.find(([method, path]) => {
    return method === request.method && path === pathname;
  });

  if (!match) {
    response.writeHead(404, {
      "content-type": "application/json; charset=utf-8",
    });
    response.end(
      JSON.stringify({
        error: `No mock route for ${request.method} ${pathname}`,
      }),
    );
    return;
  }

  const result = match[2]();
  response.writeHead(result.status, result.headers);
  response.end(result.body);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Admin mock API listening on http://127.0.0.1:${port}`);
});

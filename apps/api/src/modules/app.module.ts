import { Module } from "@nestjs/common";
import { AppCatalogModule } from "./app-catalog/app-catalog.module";
import { AuditModule } from "./audit/audit.module";
import { AuthModule } from "./auth/auth.module";
import { BillingModule } from "./billing/billing.module";
import { DeviceDiagnosticsModule } from "./device-diagnostics/device-diagnostics.module";
import { EnrollmentModule } from "./enrollment/enrollment.module";
import { HealthModule } from "./health/health.module";
import { MdmConnectorsModule } from "./mdm-connectors/mdm-connectors.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { PoliciesModule } from "./policies/policies.module";
import { PrismaModule } from "./prisma/prisma.module";
import { PrivacyModule } from "./privacy/privacy.module";
import { RemoteCommandsModule } from "./remote-commands/remote-commands.module";
import { ReportsModule } from "./reports/reports.module";
import { RosterModule } from "./roster/roster.module";
import { SupportModule } from "./support/support.module";
import { TenantsModule } from "./tenants/tenants.module";
import { TimetableModule } from "./timetable/timetable.module";
import { UsersModule } from "./users/users.module";
import { TeacherSessionsModule } from "./teacher-sessions/teacher-sessions.module";
import { GuardianModule } from "./guardian/guardian.module";
import { ClassroomModule } from "./classroom/classroom.module";
import { SisModule } from "./sis/sis.module";
import { LmsModule } from "./lms/lms.module";
import { EducationResourcesModule } from "./education-resources/education-resources.module";
import { WebhooksModule } from "./webhooks/webhooks.module";
import { ByodModule } from "./byod/byod.module";
import { ContentLibraryModule } from "./content-library/content-library.module";
import { AttendanceModule } from "./attendance/attendance.module";
import { AutomationModule } from "./automation/automation.module";
import { CommunicationsModule } from "./communications/communications.module";
import { GoogleWorkspaceModule } from "./google-workspace/google-workspace.module";
import { AppleMdmModule } from "./apple-mdm/apple-mdm.module";
import { IntuneModule } from "./intune/intune.module";
import { EnterpriseIdentityModule } from "./enterprise-identity/enterprise-identity.module";
import { AccessGovernanceModule } from "./access-governance/access-governance.module";

@Module({
  imports: [
    PrismaModule,
    PrivacyModule,
    AuthModule,
    HealthModule,
    TenantsModule,
    DeviceDiagnosticsModule,
    RosterModule,
    EnrollmentModule,
    MdmConnectorsModule,
    NotificationsModule,
    AppCatalogModule,
    PoliciesModule,
    RemoteCommandsModule,
    AuditModule,
    ReportsModule,
    BillingModule,
    UsersModule,
    TimetableModule,
    SupportModule,
    TeacherSessionsModule,
    GuardianModule,
    ClassroomModule,
    SisModule,
    LmsModule,
    EducationResourcesModule,
    WebhooksModule,
    ByodModule,
    ContentLibraryModule,
    AttendanceModule,
    AutomationModule,
    CommunicationsModule,
    GoogleWorkspaceModule,
    AppleMdmModule,
    IntuneModule,
    EnterpriseIdentityModule,
    AccessGovernanceModule,
  ],
})
export class AppModule {}

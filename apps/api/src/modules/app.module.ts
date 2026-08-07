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
  ],
})
export class AppModule {}

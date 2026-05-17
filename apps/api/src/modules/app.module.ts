import { Module } from "@nestjs/common";
import { AppCatalogModule } from "./app-catalog/app-catalog.module";
import { AuditModule } from "./audit/audit.module";
import { AuthModule } from "./auth/auth.module";
import { EnrollmentModule } from "./enrollment/enrollment.module";
import { HealthModule } from "./health/health.module";
import { MdmConnectorsModule } from "./mdm-connectors/mdm-connectors.module";
import { PoliciesModule } from "./policies/policies.module";
import { PrismaModule } from "./prisma/prisma.module";
import { RemoteCommandsModule } from "./remote-commands/remote-commands.module";
import { ReportsModule } from "./reports/reports.module";
import { RosterModule } from "./roster/roster.module";
import { TenantsModule } from "./tenants/tenants.module";
import { UsersModule } from "./users/users.module";

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    HealthModule,
    TenantsModule,
    RosterModule,
    EnrollmentModule,
    MdmConnectorsModule,
    AppCatalogModule,
    PoliciesModule,
    RemoteCommandsModule,
    AuditModule,
    ReportsModule,
    UsersModule,
  ],
})
export class AppModule {}

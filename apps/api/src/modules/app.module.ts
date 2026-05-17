import { Module } from "@nestjs/common";
import { EnrollmentModule } from "./enrollment/enrollment.module";
import { HealthModule } from "./health/health.module";
import { PrismaModule } from "./prisma/prisma.module";
import { RosterModule } from "./roster/roster.module";
import { TenantsModule } from "./tenants/tenants.module";

@Module({
  imports: [
    PrismaModule,
    HealthModule,
    TenantsModule,
    RosterModule,
    EnrollmentModule,
  ],
})
export class AppModule {}

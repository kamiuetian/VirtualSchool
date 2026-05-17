import { Module } from "@nestjs/common";
import { APP_GUARD, Reflector } from "@nestjs/core";
import { AuthService } from "./auth.service";
import { AuthRbacGuard } from "./guards/auth-rbac.guard";

@Module({
  providers: [
    AuthService,
    Reflector,
    {
      provide: APP_GUARD,
      useClass: AuthRbacGuard,
    },
  ],
})
export class AuthModule {}

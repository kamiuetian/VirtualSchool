import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Permission } from "@virtual-school/shared";
import { IS_PUBLIC_ROUTE } from "../decorators/public.decorator";
import { REQUIRED_PERMISSIONS } from "../decorators/require-permissions.decorator";
import { AuthService } from "../auth.service";
import type { AuthenticatedRequest } from "../types/authenticated-request";

@Injectable()
export class AuthRbacGuard implements CanActivate {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(Reflector) private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(
      IS_PUBLIC_ROUTE,
      [context.getHandler(), context.getClass()],
    );

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = await this.authService.authenticate(request.headers);
    request.user = user;

    const tenantIdParam = request.params?.tenantId;
    const tenantId = Array.isArray(tenantIdParam)
      ? tenantIdParam[0]
      : tenantIdParam;

    if (
      tenantId &&
      !user.tenantIds.includes("*") &&
      !user.tenantIds.includes(tenantId)
    ) {
      throw new ForbiddenException("User is not authorized for this tenant");
    }

    const requiredPermissions =
      this.reflector.getAllAndOverride<Permission[]>(REQUIRED_PERMISSIONS, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    const missingPermissions = requiredPermissions.filter(
      (permission) => !user.permissions.includes(permission),
    );

    if (missingPermissions.length > 0) {
      throw new ForbiddenException(
        `Missing required permission: ${missingPermissions.join(", ")}`,
      );
    }

    return true;
  }
}

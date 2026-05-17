import { SetMetadata } from "@nestjs/common";
import type { Permission } from "@virtual-school/shared";

export const REQUIRED_PERMISSIONS = "requiredPermissions";

export const RequirePermissions = (
  ...permissions: Permission[]
): ReturnType<typeof SetMetadata> =>
  SetMetadata(REQUIRED_PERMISSIONS, permissions);

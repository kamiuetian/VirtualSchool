import type { Role } from "@virtual-school/shared";
import type { Request } from "express";

export type AuthenticatedUser = {
  subject: string;
  email?: string;
  tenantIds: string[];
  role: Role;
  permissions: string[];
  authMode: "auth0" | "development";
};

export type AuthenticatedRequest = Request & {
  user?: AuthenticatedUser;
};

import type { Role } from "@virtual-school/shared";
import type { Request } from "express";

export type AuthenticatedUser = {
  subject: string;
  email?: string;
  tenantIds: string[];
  role: Role;
  permissions: string[];
  authMode: "auth0" | "development" | "machine";
  credentialId?: string;
  scopes?: string[];
  tokenIssuedAt?: Date;
  accessScope?: {
    type: "TENANT" | "REGION" | "BRANCH";
    branchIds: string[];
    regionCodes: string[];
  };
};

export type AuthenticatedRequest = Request & {
  user?: AuthenticatedUser;
};

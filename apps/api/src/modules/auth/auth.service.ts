import { createHash, timingSafeEqual } from "node:crypto";
import {
  HttpException,
  Injectable,
  Optional,
  UnauthorizedException,
} from "@nestjs/common";
import type { Role } from "@virtual-school/shared";
import type { JWTPayload } from "jose";
import { PrismaService } from "../prisma/prisma.service";
import { apiRolePermissions, apiRoles } from "./rbac";
import type { AuthenticatedUser } from "./types/authenticated-request";

type AuthConfig = {
  mode: "auth0" | "development";
  audience?: string;
  issuer?: string;
  jwksUri?: string;
};

@Injectable()
export class AuthService {
  private readonly config: AuthConfig;
  private jwks?: unknown;
  private readonly machineUsage = new Map<
    string,
    { count: number; window: number }
  >();

  constructor(@Optional() private readonly prisma?: PrismaService) {
    const mode = (process.env.AUTH_MODE ?? "development").toLowerCase();
    const issuer =
      process.env.AUTH0_ISSUER_BASE_URL ??
      this.issuerFromDomain(process.env.AUTH0_DOMAIN);

    this.config = {
      audience: process.env.AUTH0_AUDIENCE,
      issuer,
      jwksUri:
        process.env.AUTH0_JWKS_URI ??
        (issuer ? `${issuer}.well-known/jwks.json` : undefined),
      mode: mode === "auth0" ? "auth0" : "development",
    };

    if (this.config.mode === "auth0") {
      if (
        !this.config.audience ||
        !this.config.issuer ||
        !this.config.jwksUri
      ) {
        throw new Error(
          "AUTH_MODE=auth0 requires AUTH0_AUDIENCE and AUTH0_ISSUER_BASE_URL or AUTH0_DOMAIN",
        );
      }
    }
  }

  async authenticate(
    headers: Record<string, string | string[] | undefined>,
  ): Promise<AuthenticatedUser> {
    const authorization = this.headerValue(headers.authorization);
    const apiKey = this.headerValue(headers["x-api-key"]);
    if (apiKey || authorization?.startsWith("Bearer vst_")) {
      return this.authenticateMachine(apiKey ?? authorization!.slice(7));
    }
    if (this.config.mode === "development") {
      return this.enforceStoredUserState(this.authenticateDevelopment(headers));
    }

    const token = authorization?.startsWith("Bearer ")
      ? authorization.slice("Bearer ".length)
      : undefined;

    if (!token || !this.config.issuer || !this.config.audience) {
      throw new UnauthorizedException("Bearer token is required");
    }

    const { jwtVerify } = await this.loadJose();
    const jwks = await this.getJwks();
    const { payload } = await jwtVerify(
      token,
      jwks as Parameters<typeof jwtVerify>[1],
      {
        audience: this.config.audience,
        issuer: this.config.issuer,
      },
    );

    return this.enforceStoredUserState(this.userFromJwtPayload(payload));
  }

  private async authenticateMachine(value: string): Promise<AuthenticatedUser> {
    if (!this.prisma)
      throw new UnauthorizedException("Machine authentication is unavailable");
    const tokenHash = this.hash(value);
    let credential;
    if (value.startsWith("vsk_")) {
      const separator = value.indexOf(".");
      const clientId = separator > 4 ? value.slice(4, separator) : "";
      credential = clientId
        ? await this.prisma.machineCredential.findUnique({
            where: { clientId },
          })
        : null;
      const validCurrent =
        credential && this.safeEqual(tokenHash, credential.secretHash);
      const validPrevious =
        credential?.previousSecretHash &&
        credential.previousValidUntil &&
        credential.previousValidUntil > new Date() &&
        this.safeEqual(tokenHash, credential.previousSecretHash);
      if (!validCurrent && !validPrevious) credential = null;
    } else {
      const accessToken = await this.prisma.machineAccessToken.findUnique({
        where: { tokenHash },
        include: { credential: true },
      });
      if (accessToken && accessToken.expiresAt > new Date()) {
        credential = accessToken.credential;
        void this.prisma.machineAccessToken.update({
          where: { id: accessToken.id },
          data: { lastUsedAt: new Date() },
        });
      }
    }
    if (!credential || credential.status !== "ACTIVE") {
      throw new UnauthorizedException(
        "Machine credential is invalid or revoked",
      );
    }
    this.enforceMachineRateLimit(credential.id, credential.rateLimitPerMinute);
    void this.prisma.machineCredential.update({
      where: { id: credential.id },
      data: { lastUsedAt: new Date() },
    });
    return {
      authMode: "machine",
      credentialId: credential.id,
      permissions: this.permissionsForScopes(credential.scopes),
      role: "PLATFORM_SUPER_ADMIN",
      scopes: credential.scopes,
      subject: `machine:${credential.id}`,
      tenantIds: [credential.tenantId],
    };
  }

  private permissionsForScopes(scopes: string[]): string[] {
    const mapping: Record<string, string[]> = {
      "tenant.read": ["tenant:read"],
      "roster.read": ["tenant:read"],
      "roster.write": ["tenant:read", "roster:manage"],
      "devices.read": ["tenant:read", "device:read"],
      "reports.read": ["tenant:read", "report:export"],
      "audit.read": ["tenant:read", "audit:read"],
    };
    return [...new Set(scopes.flatMap((scope) => mapping[scope] ?? []))];
  }

  private enforceMachineRateLimit(id: string, limit: number): void {
    const window = Math.floor(Date.now() / 60_000);
    const usage = this.machineUsage.get(id);
    const next =
      !usage || usage.window !== window
        ? { count: 1, window }
        : { count: usage.count + 1, window };
    this.machineUsage.set(id, next);
    if (next.count > limit)
      throw new HttpException("Machine credential rate limit exceeded", 429);
  }

  private hash(value: string): string {
    return createHash("sha256").update(value).digest("hex");
  }
  private safeEqual(left: string, right: string): boolean {
    const a = Buffer.from(left);
    const b = Buffer.from(right);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  private async getJwks(): Promise<unknown> {
    if (this.jwks) {
      return this.jwks;
    }

    if (!this.config.jwksUri) {
      throw new UnauthorizedException("JWKS endpoint is not configured");
    }

    const { createRemoteJWKSet } = await this.loadJose();
    this.jwks = createRemoteJWKSet(new URL(this.config.jwksUri));
    return this.jwks;
  }

  private async loadJose(): Promise<typeof import("jose")> {
    const nativeImport = new Function(
      "specifier",
      "return import(specifier)",
    ) as (specifier: string) => Promise<typeof import("jose")>;
    return nativeImport("jose");
  }

  private authenticateDevelopment(
    headers: Record<string, string | string[] | undefined>,
  ): AuthenticatedUser {
    if (
      process.env.NODE_ENV === "production" &&
      process.env.ALLOW_DEVELOPMENT_AUTH_IN_PRODUCTION !== "true"
    ) {
      throw new UnauthorizedException(
        "Development authentication is disabled in production",
      );
    }

    const role = this.parseRole(
      this.headerValue(headers["x-dev-role"]) ?? "PLATFORM_SUPER_ADMIN",
    );
    const tenantHeader = this.headerValue(headers["x-dev-tenant-id"]);

    return {
      authMode: "development",
      email:
        this.headerValue(headers["x-dev-email"]) ?? "dev-admin@example.com",
      permissions: apiRolePermissions[role],
      role,
      subject: this.headerValue(headers["x-dev-subject"]) ?? "dev-user",
      tenantIds: tenantHeader
        ? tenantHeader.split(",").map((tenantId) => tenantId.trim())
        : ["*"],
    };
  }

  private userFromJwtPayload(payload: JWTPayload): AuthenticatedUser {
    const role = this.parseRole(
      this.claimString(payload, "https://virtualschool/role") ??
        this.claimString(payload, "role") ??
        "TEACHER",
    );
    const tenantIds =
      this.claimStringArray(payload, "https://virtualschool/tenant_ids") ??
      this.claimStringArray(payload, "tenant_ids") ??
      [];

    if (tenantIds.length === 0 && role !== "PLATFORM_SUPER_ADMIN") {
      throw new UnauthorizedException("Token does not include tenant scope");
    }

    return {
      authMode: "auth0",
      email: this.claimString(payload, "email"),
      permissions: apiRolePermissions[role],
      role,
      subject: payload.sub ?? "unknown",
      tokenIssuedAt:
        typeof payload.iat === "number"
          ? new Date(payload.iat * 1000)
          : undefined,
      tenantIds: role === "PLATFORM_SUPER_ADMIN" ? ["*"] : tenantIds,
    };
  }

  private async enforceStoredUserState(
    user: AuthenticatedUser,
  ): Promise<AuthenticatedUser> {
    if (!this.prisma) {
      return user;
    }

    const storedUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          { auth0Subject: user.subject },
          ...(user.email && !user.tenantIds.includes("*")
            ? [
                {
                  email: user.email,
                  tenantId: { in: user.tenantIds },
                },
              ]
            : []),
        ],
      },
      select: {
        forcedLogoutAt: true,
        status: true,
        tenantId: true,
        accessAssignments: {
          where: {
            revokedAt: null,
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
          },
          include: { template: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    if (!storedUser) {
      return user;
    }

    if (storedUser.status !== "ACTIVE") {
      throw new UnauthorizedException("User account is not active");
    }

    if (
      storedUser.forcedLogoutAt &&
      (!user.tokenIssuedAt || user.tokenIssuedAt <= storedUser.forcedLogoutAt)
    ) {
      throw new UnauthorizedException("User session has been revoked");
    }

    const assignment = storedUser.accessAssignments[0];
    if (!assignment) return user;
    const regionCodes = assignment.regionCodes as string[];
    const branchIds =
      assignment.scopeType === "BRANCH" && assignment.branchId
        ? [assignment.branchId]
        : assignment.scopeType === "REGION"
          ? (
              await this.prisma.branch.findMany({
                where: {
                  tenantId: storedUser.tenantId,
                  regionCode: { in: regionCodes },
                },
                select: { id: true },
              })
            ).map((branch) => branch.id)
          : [];
    return {
      ...user,
      permissions: assignment.template.permissions as string[],
      accessScope: {
        type: assignment.scopeType as "TENANT" | "REGION" | "BRANCH",
        branchIds,
        regionCodes,
      },
    };
  }

  private parseRole(value: string): Role {
    if (apiRoles.includes(value as Role)) {
      return value as Role;
    }

    throw new UnauthorizedException(`Unsupported role ${value}`);
  }

  private claimString(payload: JWTPayload, key: string): string | undefined {
    const value = payload[key];
    return typeof value === "string" ? value : undefined;
  }

  private claimStringArray(
    payload: JWTPayload,
    key: string,
  ): string[] | undefined {
    const value = payload[key];

    if (
      Array.isArray(value) &&
      value.every((item) => typeof item === "string")
    ) {
      return value;
    }

    if (typeof value === "string") {
      return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }

    return undefined;
  }

  private issuerFromDomain(domain: string | undefined): string | undefined {
    if (!domain) {
      return undefined;
    }

    const normalized = domain.startsWith("https://")
      ? domain
      : `https://${domain}`;
    return normalized.endsWith("/") ? normalized : `${normalized}/`;
  }

  private headerValue(
    value: string | string[] | undefined,
  ): string | undefined {
    return Array.isArray(value) ? value[0] : value;
  }
}

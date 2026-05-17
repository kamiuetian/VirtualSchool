import { Injectable, UnauthorizedException } from "@nestjs/common";
import type { Role } from "@virtual-school/shared";
import type { JWTPayload } from "jose";
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

  constructor() {
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
    if (this.config.mode === "development") {
      return this.authenticateDevelopment(headers);
    }

    const authorization = this.headerValue(headers.authorization);
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

    return this.userFromJwtPayload(payload);
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
      tenantIds: role === "PLATFORM_SUPER_ADMIN" ? ["*"] : tenantIds,
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

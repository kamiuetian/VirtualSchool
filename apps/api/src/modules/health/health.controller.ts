import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { Public } from "../auth/decorators/public.decorator";
import { PrismaService } from "../prisma/prisma.service";

type HealthResponse = {
  checks?: Record<string, "ok">;
  service: string;
  status: "ok";
  version: string;
};

@ApiTags("health")
@Public()
@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOkResponse({ description: "API liveness response" })
  getHealth(): HealthResponse {
    return {
      service: "api",
      status: "ok",
      version: "0.1.0",
    };
  }

  @Get("live")
  @ApiOkResponse({ description: "Process liveness response" })
  getLiveness(): HealthResponse {
    return this.getHealth();
  }

  @Get("ready")
  @ApiOkResponse({ description: "API and PostgreSQL readiness response" })
  async getReadiness(): Promise<HealthResponse> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { ...this.getHealth(), checks: { database: "ok" } };
    } catch {
      throw new ServiceUnavailableException({
        checks: { database: "unavailable" },
        service: "api",
        status: "unavailable",
      });
    }
  }
}

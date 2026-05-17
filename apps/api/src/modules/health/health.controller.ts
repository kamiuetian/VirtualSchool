import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";

type HealthResponse = {
  service: string;
  status: "ok";
  version: string;
};

@ApiTags("health")
@Controller("health")
export class HealthController {
  @Get()
  @ApiOkResponse({ description: "API readiness response" })
  getHealth(): HealthResponse {
    return {
      service: "api",
      status: "ok",
      version: "0.1.0"
    };
  }
}

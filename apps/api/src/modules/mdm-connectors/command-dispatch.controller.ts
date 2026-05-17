import { Body, Controller, Inject, Param, Post } from "@nestjs/common";
import { ApiCreatedResponse, ApiTags } from "@nestjs/swagger";
import type { CommandDispatchRunSummary } from "@virtual-school/shared";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator";
import { CommandDispatchService } from "./command-dispatch.service";
import { DispatchQueuedCommandsDto } from "./dto/dispatch-queued-commands.dto";

@ApiTags("mdm-connectors")
@Controller("tenants/:tenantId/command-dispatch-runs")
export class CommandDispatchController {
  constructor(
    @Inject(CommandDispatchService)
    private readonly commandDispatchService: CommandDispatchService,
  ) {}

  @Post()
  @RequirePermissions("device:command")
  @ApiCreatedResponse({
    description:
      "Dispatch queued remote commands through the active MDM connector",
  })
  dispatchQueuedCommands(
    @Param("tenantId") tenantId: string,
    @Body() body: DispatchQueuedCommandsDto,
  ): Promise<CommandDispatchRunSummary> {
    return this.commandDispatchService.dispatchQueuedCommands(
      tenantId,
      body.limit,
    );
  }
}

import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { policyPrecedence } from "@virtual-school/shared";

@Injectable()
export class ModeSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(ModeSchedulerService.name);

  onModuleInit(): void {
    this.logger.log(
      `Worker ready. Policy precedence loaded for ${Object.keys(policyPrecedence).length} learning modes.`
    );
  }
}

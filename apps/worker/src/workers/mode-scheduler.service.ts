import { Injectable, Logger, OnModuleInit } from "@nestjs/common";

@Injectable()
export class ModeSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(ModeSchedulerService.name);

  onModuleInit(): void {
    this.logger.log("Worker ready. Background queue registration starting.");
  }
}

import { Module } from "@nestjs/common";
import { ModeSchedulerService } from "./workers/mode-scheduler.service";

@Module({
  providers: [ModeSchedulerService]
})
export class WorkerModule {}

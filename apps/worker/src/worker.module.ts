import { Module } from "@nestjs/common";
import { WorkerPrismaService } from "./prisma/worker-prisma.service";
import { ModeSchedulerService } from "./workers/mode-scheduler.service";
import { WorkerJobsService } from "./workers/worker-jobs.service";
import { WorkerMdmConnector } from "./workers/worker-mdm.connector";
import { WorkerQueueService } from "./workers/worker-queue.service";
import { NotificationEmailService } from "./workers/notification-email.service";
import { ClassroomSyncService } from "./workers/classroom-sync.service";
import { WebhookDeliveryService } from "./workers/webhook-delivery.service";

@Module({
  providers: [
    ModeSchedulerService,
    WorkerJobsService,
    WorkerMdmConnector,
    WorkerPrismaService,
    WorkerQueueService,
    NotificationEmailService,
    ClassroomSyncService,
    WebhookDeliveryService,
  ],
})
export class WorkerModule {}

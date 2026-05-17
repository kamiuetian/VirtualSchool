import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { Job, Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import type {
  WorkerJobData,
  WorkerJobName,
  WorkerJobResult,
} from "./worker-job.types";
import { workerJobNames, workerQueueName } from "./worker-job.types";
import { WorkerJobsService } from "./worker-jobs.service";

@Injectable()
export class WorkerQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WorkerQueueService.name);
  private connection?: IORedis;
  private queue?: Queue<WorkerJobData, WorkerJobResult, string>;
  private worker?: Worker<WorkerJobData, WorkerJobResult, string>;

  constructor(
    @Inject(WorkerJobsService)
    private readonly workerJobsService: WorkerJobsService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (process.env.WORKER_QUEUE_ENABLED?.toLowerCase() === "false") {
      this.logger.warn("Worker queue disabled by WORKER_QUEUE_ENABLED=false");
      return;
    }

    this.connection = new IORedis(this.redisUrl(), {
      maxRetriesPerRequest: null,
    });
    this.queue = new Queue<WorkerJobData, WorkerJobResult, string>(
      workerQueueName,
      {
        connection: this.connection,
      },
    );
    this.worker = new Worker<WorkerJobData, WorkerJobResult, string>(
      workerQueueName,
      (job) => this.process(job),
      {
        concurrency: this.envInt("WORKER_CONCURRENCY", 3),
        connection: this.connection,
      },
    );

    this.worker.on("completed", (job) => {
      this.logger.log(`Completed ${job.name} job ${job.id}`);
    });
    this.worker.on("failed", (job, error) => {
      this.logger.error(
        `Failed ${job?.name ?? "unknown"} job ${job?.id ?? "unknown"}: ${
          error.message
        }`,
      );
    });

    await this.registerSchedulers();
    this.logger.log(`Worker queue ready: ${workerQueueName}`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
    await this.connection?.quit();
  }

  private process(
    job: Job<WorkerJobData, WorkerJobResult, string>,
  ): Promise<WorkerJobResult> {
    if (!workerJobNames.includes(job.name as WorkerJobName)) {
      throw new Error(`Unsupported worker job ${job.name}`);
    }

    return this.workerJobsService.processJob(
      job.name as WorkerJobName,
      job.data,
    );
  }

  private async registerSchedulers(): Promise<void> {
    if (!this.queue) {
      return;
    }

    await this.queue.upsertJobScheduler(
      "commands-dispatch",
      {
        every: this.envInt("WORKER_COMMAND_INTERVAL_MS", 60_000),
      },
      {
        data: {},
        name: "commands.dispatch",
        opts: this.jobOptions(),
      },
    );
    await this.queue.upsertJobScheduler(
      "alerts-offline-scan",
      {
        every: this.envInt("WORKER_OFFLINE_SCAN_INTERVAL_MS", 300_000),
      },
      {
        data: {},
        name: "alerts.offline-scan",
        opts: this.jobOptions(),
      },
    );
    await this.queue.upsertJobScheduler(
      "retention-dry-run",
      {
        every: this.envInt("WORKER_RETENTION_DRY_RUN_INTERVAL_MS", 86_400_000),
      },
      {
        data: {},
        name: "retention.dry-run",
        opts: this.jobOptions(),
      },
    );

    if (process.env.WORKER_RETENTION_APPLY_ENABLED === "true") {
      await this.queue.upsertJobScheduler(
        "retention-apply",
        {
          every: this.envInt("WORKER_RETENTION_APPLY_INTERVAL_MS", 86_400_000),
        },
        {
          data: {},
          name: "retention.apply",
          opts: this.jobOptions(),
        },
      );
    }
  }

  private jobOptions(): {
    attempts: number;
    removeOnComplete: number;
    removeOnFail: number;
  } {
    return {
      attempts: 3,
      removeOnComplete: 100,
      removeOnFail: 1000,
    };
  }

  private redisUrl(): string {
    return process.env.REDIS_URL ?? "redis://localhost:6379";
  }

  private envInt(name: string, fallback: number): number {
    const value = Number(process.env[name]);
    return Number.isFinite(value) && value > 0 ? value : fallback;
  }
}

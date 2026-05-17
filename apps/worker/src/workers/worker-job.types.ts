export const workerQueueName = "virtual-school-background";

export const workerJobNames = [
  "commands.dispatch",
  "alerts.offline-scan",
  "retention.dry-run",
  "retention.apply",
] as const;

export type WorkerJobName = (typeof workerJobNames)[number];

export type WorkerJobData = {
  tenantId?: string;
};

export type WorkerJobResult = {
  tenants: number;
  processed: number;
  details: Record<string, unknown>[];
};

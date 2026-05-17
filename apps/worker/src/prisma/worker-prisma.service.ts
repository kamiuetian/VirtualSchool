import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import path from "node:path";
import type { PrismaClient as GeneratedPrismaClient } from "../../../api/src/generated/prisma";

type PrismaClientConstructor = new () => GeneratedPrismaClient;

function loadPrismaClient(): PrismaClientConstructor {
  const candidates = [
    path.resolve(process.cwd(), "apps/api/src/generated/prisma"),
    path.resolve(process.cwd(), "../api/src/generated/prisma"),
    path.resolve(__dirname, "../../../../../apps/api/src/generated/prisma"),
  ];

  for (const candidate of candidates) {
    try {
      const generated = require(candidate) as {
        PrismaClient: PrismaClientConstructor;
      };

      return generated.PrismaClient;
    } catch {
      // Try the next path. The worker runs from different cwd values in dev,
      // tests, and compiled production builds.
    }
  }

  throw new Error("Unable to load generated Prisma client for worker");
}

const PrismaClient = loadPrismaClient();

@Injectable()
export class WorkerPrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}

import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { json, urlencoded } from "express";
import helmet from "helmet";
import { AppModule } from "./modules/app.module";
import { createRateLimitMiddleware } from "./modules/security/rate-limit.middleware";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
    bufferLogs: true,
  });

  if (process.env.API_TRUST_PROXY !== "false") {
    app.getHttpAdapter().getInstance().set("trust proxy", 1);
  }

  const bodyLimit = process.env.API_REQUEST_BODY_LIMIT ?? "1mb";
  app.use(json({ limit: bodyLimit }));
  app.use(urlencoded({ extended: true, limit: bodyLimit }));
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      hsts:
        process.env.NODE_ENV === "production"
          ? { includeSubDomains: true, maxAge: 15552000 }
          : false,
    }),
  );
  app.use(
    createRateLimitMiddleware({
      enabled: process.env.API_RATE_LIMIT_ENABLED !== "false",
      maxRequests: Number(process.env.API_RATE_LIMIT_MAX ?? 300),
      windowMs: Number(process.env.API_RATE_LIMIT_WINDOW_MS ?? 60_000),
    }),
  );
  app.enableCors({
    credentials: true,
    origin: corsOrigin,
  });

  app.setGlobalPrefix("api/v1");
  app.useGlobalPipes(
    new ValidationPipe({
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      whitelist: true,
    }),
  );

  if (apiDocsEnabled()) {
    const config = new DocumentBuilder()
      .setTitle("Virtual School MDM API")
      .setDescription("Phase 1 Android Managed Learning Device Platform API")
      .setVersion("0.1.0")
      .addBearerAuth()
      .build();

    SwaggerModule.setup(
      "api/docs",
      app,
      SwaggerModule.createDocument(app, config),
    );
  }

  const port = Number(process.env.API_PORT ?? 4000);
  app.enableShutdownHooks();
  await app.listen(port);
}

function apiDocsEnabled(): boolean {
  return (
    process.env.API_DOCS_ENABLED === "true" ||
    (process.env.API_DOCS_ENABLED !== "false" &&
      process.env.NODE_ENV !== "production")
  );
}

function corsOrigin(
  origin: string | undefined,
  callback: (error: Error | null, allow?: boolean) => void,
): void {
  const configuredOrigins = (process.env.API_CORS_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (!origin) {
    callback(null, true);
    return;
  }

  if (configuredOrigins.includes(origin)) {
    callback(null, true);
    return;
  }

  if (
    process.env.NODE_ENV !== "production" &&
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
  ) {
    callback(null, true);
    return;
  }

  callback(new Error("CORS origin denied"), false);
}

void bootstrap();

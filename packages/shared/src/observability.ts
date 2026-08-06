type LogLevel = "debug" | "error" | "info" | "warn";

type LogRecord = {
  context?: string;
  error?: { message: string; stack?: string };
  level: LogLevel;
  message: string;
  service: string;
  timestamp: string;
};

export class JsonLogger {
  constructor(private readonly service: string) {}

  log(message: unknown, context?: string): void {
    this.write("info", message, context);
  }

  error(message: unknown, trace?: string, context?: string): void {
    const error =
      message instanceof Error
        ? { message: message.message, stack: message.stack }
        : trace
          ? { message: String(message), stack: trace }
          : undefined;
    this.write("error", message, context, error);
  }

  warn(message: unknown, context?: string): void {
    this.write("warn", message, context);
  }

  debug(message: unknown, context?: string): void {
    this.write("debug", message, context);
  }

  verbose(message: unknown, context?: string): void {
    this.write("debug", message, context);
  }

  private write(
    level: LogLevel,
    value: unknown,
    context?: string,
    error?: LogRecord["error"],
  ): void {
    const record: LogRecord = {
      context,
      error,
      level,
      message: value instanceof Error ? value.message : String(value),
      service: this.service,
      timestamp: new Date().toISOString(),
    };
    const output = JSON.stringify(record);
    if (level === "error") {
      console.error(output);
    } else if (level === "warn") {
      console.warn(output);
    } else {
      console.log(output);
    }
  }
}

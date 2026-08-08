import { Injectable } from "@nestjs/common";

export type EmailSendResult = {
  delivered: boolean;
  failureReason?: string;
  provider: string;
  providerId?: string;
  retryable?: boolean;
};

@Injectable()
export class NotificationEmailService {
  async send(input: {
    recipient: string;
    subject: string;
    text: string;
    tenantId: string;
    alertId: string;
    branding?: {
      name: string;
      logoUrl?: string | null;
      primaryColor?: string | null;
      accentColor?: string | null;
      supportEmail?: string | null;
      supportPhone?: string | null;
      websiteUrl?: string | null;
    };
  }): Promise<EmailSendResult> {
    const endpoint = process.env.EMAIL_DELIVERY_WEBHOOK_URL;
    if (!endpoint) {
      return {
        delivered: false,
        failureReason: "EMAIL_DELIVERY_WEBHOOK_URL is not configured",
        provider: "WEBHOOK",
        retryable: false,
      };
    }
    try {
      const response = await fetch(endpoint, {
        body: JSON.stringify({
          alertId: input.alertId,
          branding: input.branding,
          from: process.env.EMAIL_FROM ?? "alerts@virtualschool.local",
          subject: input.subject,
          tenantId: input.tenantId,
          text: input.text,
          to: input.recipient,
        }),
        headers: {
          "Content-Type": "application/json",
          ...(process.env.EMAIL_DELIVERY_WEBHOOK_TOKEN
            ? {
                Authorization: `Bearer ${process.env.EMAIL_DELIVERY_WEBHOOK_TOKEN}`,
              }
            : {}),
        },
        method: "POST",
        signal: AbortSignal.timeout(
          this.envInt("EMAIL_DELIVERY_TIMEOUT_MS", 10_000),
        ),
      });
      if (!response.ok) {
        return {
          delivered: false,
          failureReason: `Email provider returned HTTP ${response.status}`,
          provider: "WEBHOOK",
          retryable: response.status === 429 || response.status >= 500,
        };
      }
      const body = (await response.json().catch(() => ({}))) as {
        id?: unknown;
      };
      return {
        delivered: true,
        provider: "WEBHOOK",
        providerId: typeof body.id === "string" ? body.id : undefined,
      };
    } catch (error) {
      return {
        delivered: false,
        failureReason:
          error instanceof Error ? error.message : "Email delivery failed",
        provider: "WEBHOOK",
        retryable: true,
      };
    }
  }

  private envInt(name: string, fallback: number): number {
    const value = Number(process.env[name]);
    return Number.isFinite(value) && value > 0 ? value : fallback;
  }
}

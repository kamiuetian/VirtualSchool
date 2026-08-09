export type IntegrationReviewStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "IN_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "PUBLISHED";

export interface IntegrationMarketplaceItem {
  id: string;
  slug: string;
  version: number;
  name: string;
  description: string;
  category: string;
  status: IntegrationReviewStatus;
  reviewNotes: string | null;
  publishedAt: string | null;
  installation: null | {
    id: string;
    status: "ENABLED" | "DISABLED";
    lastTestStatus: "SUCCEEDED" | "FAILED" | null;
    lastTestedAt: string | null;
  };
}

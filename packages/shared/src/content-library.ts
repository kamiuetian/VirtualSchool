export const contentLibraryTypes = [
  "APP",
  "LINK",
  "PDF",
  "WORKSHEET",
  "VIDEO",
  "LMS",
  "EXAM",
] as const;

export type ContentLibraryType = (typeof contentLibraryTypes)[number];

export type ContentLibraryItemSummary = {
  id: string;
  tenantId: string;
  title: string;
  description: string | null;
  type: ContentLibraryType;
  category: string;
  locator: string;
  grades: string[];
  subjects: string[];
  classIds: string[];
  status: "ACTIVE" | "ARCHIVED";
  expiresAt: string | null;
  expired: boolean;
  offlineEnabled: boolean;
  offlineVersion: number | null;
  offlineSha256: string | null;
  offlineSizeBytes: number | null;
  offlinePolicyIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type ContentLibraryReport = {
  active: number;
  archived: number;
  expired: number;
  expiringWithin30Days: number;
  expiredItems: ContentLibraryItemSummary[];
};

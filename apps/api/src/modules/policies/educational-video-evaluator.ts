import type { EducationalVideoAllowlistEntry } from "@virtual-school/shared";

export function matchesEducationalVideo(
  rawUrl: string,
  entries: EducationalVideoAllowlistEntry[],
) {
  const url = new URL(rawUrl);
  const host = url.hostname.toLowerCase();
  for (const entry of entries) {
    const value = entry.value.toLowerCase();
    if (
      entry.kind === "DOMAIN" &&
      (host === value || host.endsWith(`.${value}`))
    )
      return entry;
    if (!["youtube.com", "www.youtube.com", "youtu.be"].includes(host))
      continue;
    if (entry.kind === "VIDEO") {
      const id =
        host === "youtu.be" ? url.pathname.slice(1) : url.searchParams.get("v");
      if (id?.toLowerCase() === value) return entry;
    }
    if (
      entry.kind === "PLAYLIST" &&
      url.searchParams.get("list")?.toLowerCase() === value
    )
      return entry;
    if (
      entry.kind === "CHANNEL" &&
      url.pathname.toLowerCase() === `/channel/${value}`
    )
      return entry;
  }
  return null;
}

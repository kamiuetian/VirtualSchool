import type {
  PolicyRuleSet,
  UrlPolicySimulation,
} from "@virtual-school/shared";

type Evaluation = Omit<
  UrlPolicySimulation,
  "policyId" | "policyVersion" | "url"
>;

export function evaluateUrlPolicy(
  url: string,
  rules: Pick<
    PolicyRuleSet,
    "defaultWebAccess" | "urlAllowlist" | "urlBlocklist"
  >,
): Evaluation {
  const parsed = parseHttpUrl(url);
  if (!parsed)
    throw new Error("A valid HTTP(S) URL without credentials is required");
  const blocked = rules.urlBlocklist.find((rule) =>
    matchesUrlRule(parsed, rule),
  );
  if (blocked)
    return {
      decision: "BLOCKED",
      effectiveAccess: "DENY",
      matchedRule: blocked,
      reason: "BLOCKLIST",
    };
  const allowed = rules.urlAllowlist.find((rule) =>
    matchesUrlRule(parsed, rule),
  );
  if (allowed)
    return {
      decision: "ALLOWED",
      effectiveAccess: "ALLOW",
      matchedRule: allowed,
      reason: "ALLOWLIST",
    };
  return {
    decision: "UNMATCHED",
    effectiveAccess: rules.defaultWebAccess,
    matchedRule: null,
    reason:
      rules.defaultWebAccess === "ALLOW" ? "DEFAULT_ALLOW" : "DEFAULT_DENY",
  };
}

function parseHttpUrl(value: string): URL | null {
  try {
    const url = new URL(value.trim());
    return (url.protocol === "http:" || url.protocol === "https:") &&
      !url.username &&
      !url.password
      ? url
      : null;
  } catch {
    return null;
  }
}

function matchesUrlRule(url: URL, rawRule: string): boolean {
  const rule = rawRule.trim();
  if (!rule) return false;
  const wildcard = rule.endsWith("*");
  const parsedRule = parseHttpUrl(wildcard ? rule.slice(0, -1) : rule);
  if (
    !parsedRule ||
    parsedRule.protocol !== url.protocol ||
    parsedRule.hostname.toLowerCase() !== url.hostname.toLowerCase() ||
    effectivePort(parsedRule) !== effectivePort(url)
  )
    return false;
  const rulePath = (parsedRule.pathname || "/").toLowerCase();
  const urlPath = (url.pathname || "/").toLowerCase();
  if (wildcard) return urlPath.startsWith(rulePath);
  return (
    urlPath === rulePath ||
    (rulePath.endsWith("/")
      ? urlPath.startsWith(rulePath)
      : urlPath.startsWith(`${rulePath}/`))
  );
}

function effectivePort(url: URL): string {
  return url.port || (url.protocol === "https:" ? "443" : "80");
}

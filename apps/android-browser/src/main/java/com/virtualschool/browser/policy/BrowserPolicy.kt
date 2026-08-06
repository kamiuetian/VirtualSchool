package com.virtualschool.browser.policy

import java.net.URI

data class BrowserPolicy(
    val policyId: String,
    val policyVersion: Int,
    val defaultWebAccess: WebAccessMode,
    val urlAllowlist: List<String>,
    val urlBlocklist: List<String>,
    val homeUrl: String?,
)

enum class WebAccessMode {
    ALLOW,
    DENY,
}

enum class NavigationDecision {
    ALLOW,
    BLOCK,
}

data class NavigationEvaluation(
    val decision: NavigationDecision,
    val reason: String,
    val matchedRule: String? = null,
)

object BrowserPolicyResolver {
    fun resolve(managed: BrowserPolicy?, cached: BrowserPolicy?): BrowserPolicy =
        managed ?: cached ?: LocalPolicyStore.safeDefault
}

object BrowserPolicyEvaluator {
    fun evaluate(rawUrl: String, policy: BrowserPolicy): NavigationEvaluation {
        val normalizedUrl = rawUrl.trim()

        if (normalizedUrl.isEmpty()) {
            return NavigationEvaluation(
                decision = NavigationDecision.BLOCK,
                reason = "EMPTY_URL",
            )
        }

        if (parseHttpUrl(normalizedUrl) == null) {
            return NavigationEvaluation(
                decision = NavigationDecision.BLOCK,
                reason = "UNSUPPORTED_SCHEME",
            )
        }

        val blockedRule = policy.urlBlocklist.firstOrNull { rule ->
            matchesRule(normalizedUrl, rule)
        }

        if (blockedRule != null) {
            return NavigationEvaluation(
                decision = NavigationDecision.BLOCK,
                reason = "BLOCKLIST",
                matchedRule = blockedRule,
            )
        }

        val allowedRule = policy.urlAllowlist.firstOrNull { rule ->
            matchesRule(normalizedUrl, rule)
        }

        if (allowedRule != null) {
            return NavigationEvaluation(
                decision = NavigationDecision.ALLOW,
                reason = "ALLOWLIST",
                matchedRule = allowedRule,
            )
        }

        return when (policy.defaultWebAccess) {
            WebAccessMode.ALLOW -> NavigationEvaluation(
                decision = NavigationDecision.ALLOW,
                reason = "DEFAULT_ALLOW",
            )
            WebAccessMode.DENY -> NavigationEvaluation(
                decision = NavigationDecision.BLOCK,
                reason = "DEFAULT_DENY",
            )
        }
    }

    private fun matchesRule(url: String, rule: String): Boolean {
        val normalizedRule = rule.trim()

        if (normalizedRule.isEmpty()) {
            return false
        }

        val wildcard = normalizedRule.endsWith("*")
        val ruleUri = parseHttpUrl(if (wildcard) normalizedRule.dropLast(1) else normalizedRule)
            ?: return false
        val urlUri = parseHttpUrl(url) ?: return false
        if (!ruleUri.scheme.equals(urlUri.scheme, true) ||
            !ruleUri.host.equals(urlUri.host, true) ||
            effectivePort(ruleUri) != effectivePort(urlUri)
        ) return false

        val rulePath = ruleUri.rawPath.orEmpty().ifEmpty { "/" }
        val urlPath = urlUri.rawPath.orEmpty().ifEmpty { "/" }
        if (wildcard) return urlPath.startsWith(rulePath, ignoreCase = true)
        return urlPath.equals(rulePath, true) ||
            (rulePath.endsWith("/") && urlPath.startsWith(rulePath, true)) ||
            (!rulePath.endsWith("/") && urlPath.startsWith("$rulePath/", true))
    }

    private fun parseHttpUrl(value: String): URI? = runCatching { URI(value) }
        .getOrNull()
        ?.takeIf { it.scheme.equals("https", true) || it.scheme.equals("http", true) }
        ?.takeIf { !it.host.isNullOrBlank() && it.userInfo == null }

    private fun effectivePort(uri: URI): Int = when {
        uri.port >= 0 -> uri.port
        uri.scheme.equals("https", true) -> 443
        else -> 80
    }
}

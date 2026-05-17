package com.virtualschool.browser.policy

data class BrowserPolicy(
    val defaultWebAccess: WebAccessMode,
    val urlAllowlist: List<String>,
    val urlBlocklist: List<String>,
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

object BrowserPolicyEvaluator {
    fun evaluate(rawUrl: String, policy: BrowserPolicy): NavigationEvaluation {
        val normalizedUrl = rawUrl.trim()

        if (normalizedUrl.isEmpty()) {
            return NavigationEvaluation(
                decision = NavigationDecision.BLOCK,
                reason = "EMPTY_URL",
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

        if (normalizedRule.endsWith("*")) {
            return url.startsWith(normalizedRule.dropLast(1), ignoreCase = true)
        }

        return url.equals(normalizedRule, ignoreCase = true) ||
            url.startsWith("$normalizedRule/", ignoreCase = true)
    }
}

package com.virtualschool.browser.policy

import org.junit.Assert.assertEquals
import org.junit.Test

class BrowserPolicyEvaluatorTest {
    private val defaultDenyPolicy = BrowserPolicy(
        defaultWebAccess = WebAccessMode.DENY,
        urlAllowlist = listOf("https://math.example.edu", "https://reading.example.edu/lessons/*"),
        urlBlocklist = listOf("https://math.example.edu/blocked"),
    )

    @Test
    fun allowsExplicitAllowlistMatches() {
        val result = BrowserPolicyEvaluator.evaluate(
            rawUrl = "https://math.example.edu",
            policy = defaultDenyPolicy,
        )

        assertEquals(NavigationDecision.ALLOW, result.decision)
        assertEquals("ALLOWLIST", result.reason)
    }

    @Test
    fun blocksExplicitBlocklistBeforeAllowlist() {
        val result = BrowserPolicyEvaluator.evaluate(
            rawUrl = "https://math.example.edu/blocked",
            policy = defaultDenyPolicy,
        )

        assertEquals(NavigationDecision.BLOCK, result.decision)
        assertEquals("BLOCKLIST", result.reason)
    }

    @Test
    fun supportsPrefixWildcardRules() {
        val result = BrowserPolicyEvaluator.evaluate(
            rawUrl = "https://reading.example.edu/lessons/one",
            policy = defaultDenyPolicy,
        )

        assertEquals(NavigationDecision.ALLOW, result.decision)
    }

    @Test
    fun blocksUnmatchedUrlsWhenDefaultDeny() {
        val result = BrowserPolicyEvaluator.evaluate(
            rawUrl = "https://unknown.example.edu",
            policy = defaultDenyPolicy,
        )

        assertEquals(NavigationDecision.BLOCK, result.decision)
        assertEquals("DEFAULT_DENY", result.reason)
    }

    @Test
    fun allowsUnmatchedUrlsWhenDefaultAllow() {
        val result = BrowserPolicyEvaluator.evaluate(
            rawUrl = "https://unknown.example.edu",
            policy = BrowserPolicy(
                defaultWebAccess = WebAccessMode.ALLOW,
                urlAllowlist = emptyList(),
                urlBlocklist = emptyList(),
            ),
        )

        assertEquals(NavigationDecision.ALLOW, result.decision)
        assertEquals("DEFAULT_ALLOW", result.reason)
    }
}

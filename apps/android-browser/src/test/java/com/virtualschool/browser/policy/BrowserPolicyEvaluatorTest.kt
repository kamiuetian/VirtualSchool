package com.virtualschool.browser.policy

import org.junit.Assert.assertEquals
import org.junit.Test

class BrowserPolicyEvaluatorTest {
    private val defaultDenyPolicy = BrowserPolicy(
        policyId = "policy-1",
        policyVersion = 3,
        defaultWebAccess = WebAccessMode.DENY,
        urlAllowlist = listOf("https://math.example.edu", "https://reading.example.edu/lessons/*"),
        urlBlocklist = listOf("https://math.example.edu/blocked"),
        homeUrl = "https://math.example.edu",
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
                policyId = "policy-2",
                policyVersion = 1,
                defaultWebAccess = WebAccessMode.ALLOW,
                urlAllowlist = emptyList(),
                urlBlocklist = emptyList(),
                homeUrl = null,
            ),
        )

        assertEquals(NavigationDecision.ALLOW, result.decision)
        assertEquals("DEFAULT_ALLOW", result.reason)
    }

    @Test
    fun rejectsLookalikeHostsAndUnsafeSchemes() {
        assertEquals(
            NavigationDecision.BLOCK,
            BrowserPolicyEvaluator.evaluate("https://math.example.edu.attacker.test", defaultDenyPolicy).decision,
        )
        val unsafe = BrowserPolicyEvaluator.evaluate("javascript:alert(1)", defaultDenyPolicy)
        assertEquals(NavigationDecision.BLOCK, unsafe.decision)
        assertEquals("UNSUPPORTED_SCHEME", unsafe.reason)
    }

    @Test
    fun wildcardOnlyMatchesPathsOnTheSameOrigin() {
        assertEquals(
            NavigationDecision.ALLOW,
            BrowserPolicyEvaluator.evaluate("https://reading.example.edu/lessons/two", defaultDenyPolicy).decision,
        )
        assertEquals(
            NavigationDecision.BLOCK,
            BrowserPolicyEvaluator.evaluate("https://reading.example.edu/other", defaultDenyPolicy).decision,
        )
    }

    @Test
    fun usesCachedPolicyOfflineAndFailsClosedWithoutPolicy() {
        assertEquals(defaultDenyPolicy, BrowserPolicyResolver.resolve(null, defaultDenyPolicy))
        val fallback = BrowserPolicyResolver.resolve(null, null)
        assertEquals("unmanaged", fallback.policyId)
        assertEquals(WebAccessMode.DENY, fallback.defaultWebAccess)
        assertEquals(emptyList<String>(), fallback.urlAllowlist)
    }
}

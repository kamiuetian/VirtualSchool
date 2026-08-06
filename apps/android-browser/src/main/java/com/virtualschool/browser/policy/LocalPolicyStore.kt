package com.virtualschool.browser.policy

object LocalPolicyStore {
    val safeDefault = BrowserPolicy(
        policyId = "unmanaged",
        policyVersion = 0,
        defaultWebAccess = WebAccessMode.DENY,
        urlAllowlist = emptyList(),
        urlBlocklist = emptyList(),
        homeUrl = null,
    )
}

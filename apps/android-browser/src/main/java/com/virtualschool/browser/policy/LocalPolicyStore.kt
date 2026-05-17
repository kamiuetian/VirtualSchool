package com.virtualschool.browser.policy

object LocalPolicyStore {
    val defaultPolicy = BrowserPolicy(
        defaultWebAccess = WebAccessMode.DENY,
        urlAllowlist = listOf(
            "https://math.example.edu",
            "https://reading.example.edu",
        ),
        urlBlocklist = listOf(
            "https://blocked.example.edu",
        ),
    )
}

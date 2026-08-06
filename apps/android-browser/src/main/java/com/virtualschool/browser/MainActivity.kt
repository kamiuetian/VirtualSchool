package com.virtualschool.browser

import android.app.Activity
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Bundle
import android.view.ViewGroup
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.LinearLayout
import android.widget.TextView
import com.virtualschool.browser.policy.BrowserPolicy
import com.virtualschool.browser.policy.BrowserPolicyEvaluator
import com.virtualschool.browser.policy.ManagedBrowserPolicyStore
import com.virtualschool.browser.policy.NavigationDecision

class MainActivity : Activity() {
    private lateinit var policyStore: ManagedBrowserPolicyStore
    private lateinit var blockedEventReporter: BlockedEventReporter
    private lateinit var browser: WebView
    private val policyChangedReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) = applyPolicy()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        policyStore = ManagedBrowserPolicyStore(this)
        blockedEventReporter = QueuedBlockedEventReporter(this)
        val policy = policyStore.current()

        val status = TextView(this).apply {
            text = "Mode: Default School"
            textSize = 16f
            setPadding(24, 24, 24, 12)
        }

        browser = WebView(this).apply {
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                0,
                1f,
            )
            webViewClient = PolicyWebViewClient(policy, blockedEventReporter)
            settings.javaScriptEnabled = false
            openHome(policy)
        }

        setContentView(
            LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                addView(status)
                addView(browser)
            },
        )
    }

    override fun onStart() {
        super.onStart()
        registerReceiver(policyChangedReceiver, IntentFilter(Intent.ACTION_APPLICATION_RESTRICTIONS_CHANGED))
    }

    override fun onStop() {
        unregisterReceiver(policyChangedReceiver)
        super.onStop()
    }

    private fun applyPolicy() {
        val policy = policyStore.current()
        browser.webViewClient = PolicyWebViewClient(policy, blockedEventReporter)
        browser.openHome(policy)
    }

    private fun WebView.openHome(policy: BrowserPolicy) {
        val home = policy.homeUrl
        if (home != null && BrowserPolicyEvaluator.evaluate(home, policy).decision == NavigationDecision.ALLOW) {
            loadUrl(home)
        } else {
            loadData("<h1>Learning Browser</h1><p>No approved home page is available.</p>", "text/html", "UTF-8")
        }
    }

    private class PolicyWebViewClient(
        private val policy: BrowserPolicy,
        private val blockedEventReporter: BlockedEventReporter,
    ) : WebViewClient() {
        override fun shouldOverrideUrlLoading(
            view: WebView,
            request: WebResourceRequest,
        ): Boolean {
            return handleNavigation(view, request.url.toString())
        }

        @Deprecated("Required for older Android WebView callbacks.")
        override fun shouldOverrideUrlLoading(view: WebView, url: String): Boolean {
            return handleNavigation(view, url)
        }

        private fun handleNavigation(view: WebView, url: String): Boolean {
            val evaluation = BrowserPolicyEvaluator.evaluate(url, policy)

            if (evaluation.decision == NavigationDecision.ALLOW) {
                return false
            }

            blockedEventReporter.report(
                BlockedWebEvent(
                    domain = QueuedBlockedEventReporter.domain(url),
                    reason = evaluation.reason,
                    matchedRule = evaluation.matchedRule,
                    policyId = policy.policyId,
                    policyVersion = policy.policyVersion,
                ),
            )
            view.loadData(
                """
                    <h1>Site blocked</h1>
                    <p>This site is not available in the current learning mode.</p>
                """.trimIndent(),
                "text/html",
                "UTF-8",
            )
            return true
        }
    }
}

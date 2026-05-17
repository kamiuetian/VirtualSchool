package com.virtualschool.browser

import android.app.Activity
import android.os.Bundle
import android.view.ViewGroup
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.LinearLayout
import android.widget.TextView
import com.virtualschool.browser.policy.BrowserPolicy
import com.virtualschool.browser.policy.BrowserPolicyEvaluator
import com.virtualschool.browser.policy.LocalPolicyStore
import com.virtualschool.browser.policy.NavigationDecision

class MainActivity : Activity() {
    private val policy: BrowserPolicy = LocalPolicyStore.defaultPolicy
    private val blockedEventReporter: BlockedEventReporter = LogcatBlockedEventReporter()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val status = TextView(this).apply {
            text = "Mode: Default School"
            textSize = 16f
            setPadding(24, 24, 24, 12)
        }

        val browser = WebView(this).apply {
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                0,
                1f,
            )
            webViewClient = PolicyWebViewClient(policy, blockedEventReporter)
            settings.javaScriptEnabled = false
            loadData(
                """
                    <h1>Learning Browser</h1>
                    <p>Approved links</p>
                    <ul>
                      <li><a href="https://math.example.edu">Math</a></li>
                      <li><a href="https://reading.example.edu">Reading</a></li>
                      <li><a href="https://blocked.example.edu">Blocked example</a></li>
                    </ul>
                """.trimIndent(),
                "text/html",
                "UTF-8",
            )
        }

        setContentView(
            LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                addView(status)
                addView(browser)
            },
        )
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
                    url = url,
                    reason = evaluation.reason,
                    matchedRule = evaluation.matchedRule,
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

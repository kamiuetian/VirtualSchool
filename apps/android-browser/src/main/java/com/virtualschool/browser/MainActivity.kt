package com.virtualschool.browser

import android.app.Activity
import android.os.Bundle
import android.webkit.WebView
import android.webkit.WebViewClient

class MainActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val browser = WebView(this).apply {
            webViewClient = WebViewClient()
            settings.javaScriptEnabled = false
            loadData(
                "<h1>Learning Browser</h1><p>Policy-controlled browsing will be enforced here.</p>",
                "text/html",
                "UTF-8"
            )
        }

        setContentView(browser)
    }
}

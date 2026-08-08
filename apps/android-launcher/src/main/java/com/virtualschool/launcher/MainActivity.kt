package com.virtualschool.launcher

import android.app.Activity
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.view.Gravity
import android.view.ViewGroup
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import com.virtualschool.launcher.policy.LauncherPolicy
import com.virtualschool.launcher.policy.ManagedPolicyStore
import com.virtualschool.launcher.policy.OfflineLessonCache

class MainActivity : Activity() {
    private lateinit var policyStore: ManagedPolicyStore
    private lateinit var offlineCache: OfflineLessonCache
    private var refreshedOfflineKey: String? = null
    private val policyChangedReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) = render()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        policyStore = ManagedPolicyStore(this)
        offlineCache = OfflineLessonCache(java.io.File(filesDir, "offline-lessons"))
        render()
    }

    override fun onResume() {
        super.onResume()
        render()
    }

    override fun onStart() {
        super.onStart()
        registerReceiver(
            policyChangedReceiver,
            IntentFilter(Intent.ACTION_APPLICATION_RESTRICTIONS_CHANGED),
        )
    }

    override fun onStop() {
        unregisterReceiver(policyChangedReceiver)
        super.onStop()
    }

    @Deprecated("The managed HOME activity must remain the foreground experience.")
    override fun onBackPressed() = Unit

    private fun render() {
        val policy = policyStore.current()
        offlineCache.reconcile(policy.offlineResources)
        val content = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(32, 32, 32, 32)
            addView(header("Virtual School", 26f))
            addView(header("Mode: ${policy.displayMode()} · Policy ${policy.policyVersion}", 16f))
        }

        if (policy.isLostMode) {
            content.addView(message("This device is managed by your school. Please return it to school staff."))
        } else {
            addApps(content, policy)
            addShortcuts(content, policy)
            addOfflineLessons(content, policy)
            if (policy.showMessages) content.addView(message("School messages are enabled for this device."))
        }

        if (policy.showSupportContact) {
            content.addView(message("Need help? Contact your school support team."))
        }

        setContentView(ScrollView(this).apply { addView(content) })
        val refreshKey = "${policy.policyId}:${policy.policyVersion}:${policy.offlineResources.joinToString { "${it.id}:${it.version}" }}"
        if (policy.offlineResources.isNotEmpty() && refreshedOfflineKey != refreshKey) {
            refreshedOfflineKey = refreshKey
            Thread {
                offlineCache.refresh(policy.offlineResources)
                runOnUiThread { render() }
            }.start()
        }
    }

    private fun addApps(content: LinearLayout, policy: LauncherPolicy) {
        content.addView(header("Approved apps", 20f))
        val apps = policy.safeApprovedApps()
        if (apps.isEmpty()) content.addView(message("No apps are available in this mode."))
        apps.forEach { app ->
            content.addView(action(app.name) {
                packageManager.getLaunchIntentForPackage(app.packageId)?.let(::startActivity)
            })
        }
    }

    private fun addShortcuts(content: LinearLayout, policy: LauncherPolicy) {
        content.addView(header("Learning links", 20f))
        policy.safeWebShortcuts().forEach { shortcut ->
            content.addView(action(shortcut.title) {
                startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(shortcut.url)).setPackage(SECURE_BROWSER))
            })
        }
    }

    private fun addOfflineLessons(content: LinearLayout, policy: LauncherPolicy) {
        content.addView(header("Offline Mode", 20f))
        val cached = offlineCache.cached(policy.offlineResources)
        if (cached.isEmpty()) content.addView(message("No verified lessons are available offline."))
        cached.forEach { content.addView(message("${it.title} · ${it.type.lowercase()} · v${it.version}")) }
    }

    private fun header(value: String, size: Float) = TextView(this).apply {
        text = value
        textSize = size
        setTextColor(Color.rgb(21, 48, 74))
        setPadding(0, 12, 0, 12)
    }

    private fun message(value: String) = TextView(this).apply {
        text = value
        textSize = 16f
        setPadding(0, 14, 0, 14)
    }

    private fun action(label: String, listener: () -> Unit) = Button(this).apply {
        text = label
        gravity = Gravity.START or Gravity.CENTER_VERTICAL
        layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
        setOnClickListener { listener() }
    }

    private companion object {
        const val SECURE_BROWSER = "com.virtualschool.browser"
    }
}

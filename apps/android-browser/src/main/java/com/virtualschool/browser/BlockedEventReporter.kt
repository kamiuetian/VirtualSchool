package com.virtualschool.browser

import android.content.Context
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject
import java.net.URI

data class BlockedWebEvent(
    val domain: String,
    val reason: String,
    val matchedRule: String?,
    val policyId: String,
    val policyVersion: Int,
    val occurredAtMillis: Long = System.currentTimeMillis(),
)

interface BlockedEventReporter {
    fun report(event: BlockedWebEvent)
}

class QueuedBlockedEventReporter(context: Context) : BlockedEventReporter {
    private val preferences = context.getSharedPreferences("blocked-web-events", Context.MODE_PRIVATE)

    override fun report(event: BlockedWebEvent) {
        val queue = runCatching { JSONArray(preferences.getString(EVENT_QUEUE, "[]")) }.getOrDefault(JSONArray())
        queue.put(JSONObject()
            .put("domain", event.domain)
            .put("reason", event.reason)
            .put("matchedRule", event.matchedRule)
            .put("policyId", event.policyId)
            .put("policyVersion", event.policyVersion)
            .put("occurredAtMillis", event.occurredAtMillis))
        while (queue.length() > MAX_QUEUED_EVENTS) queue.remove(0)
        preferences.edit().putString(EVENT_QUEUE, queue.toString()).apply()
        Log.i(
            "VirtualSchoolBrowser",
            "Queued blocked navigation domain=${event.domain} reason=${event.reason} policy=${event.policyId}:${event.policyVersion}",
        )
    }

    companion object {
        fun domain(rawUrl: String): String = runCatching { URI(rawUrl).host?.lowercase() }
            .getOrNull() ?: "invalid"
        private const val EVENT_QUEUE = "pending-events"
        private const val MAX_QUEUED_EVENTS = 500
    }
}

package com.virtualschool.browser

import android.util.Log

data class BlockedWebEvent(
    val url: String,
    val reason: String,
    val matchedRule: String?,
    val occurredAtMillis: Long = System.currentTimeMillis(),
)

interface BlockedEventReporter {
    fun report(event: BlockedWebEvent)
}

class LogcatBlockedEventReporter : BlockedEventReporter {
    override fun report(event: BlockedWebEvent) {
        Log.i(
            "VirtualSchoolBrowser",
            "Blocked web navigation reason=${event.reason} matchedRule=${event.matchedRule} url=${event.url}",
        )
    }
}

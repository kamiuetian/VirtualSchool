package com.virtualschool.launcher.policy

import java.net.URI

data class ApprovedApp(
    val name: String,
    val packageId: String,
)

data class WebShortcut(
    val title: String,
    val url: String,
)

data class OfflineLessonResource(
    val id: String,
    val title: String,
    val type: String,
    val url: String,
    val version: Int,
    val sha256: String,
    val sizeBytes: Long,
    val expiresAtEpochMillis: Long?,
)

data class LauncherPolicy(
    val policyId: String,
    val policyVersion: Int,
    val mode: String,
    val approvedApps: List<ApprovedApp>,
    val webShortcuts: List<WebShortcut>,
    val showMessages: Boolean,
    val showSupportContact: Boolean,
    val language: String = "en",
    val offlineResources: List<OfflineLessonResource> = emptyList(),
) {
    fun safeApprovedApps(): List<ApprovedApp> = approvedApps
        .filter { it.name.isNotBlank() && PACKAGE_NAME.matches(it.packageId) }
        .distinctBy { it.packageId }

    fun safeWebShortcuts(): List<WebShortcut> = webShortcuts
        .filter { shortcut ->
            shortcut.title.isNotBlank() && isSafeHttpsUrl(shortcut.url)
        }
        .distinctBy { it.url }

    fun displayMode(): String = mode
        .lowercase()
        .split('_')
        .joinToString(" ") { word -> word.replaceFirstChar(Char::uppercase) }

    val isLostMode: Boolean
        get() = mode == "LOST_DEVICE"

    companion object {
        private val PACKAGE_NAME = Regex("^[A-Za-z][A-Za-z0-9_]*(\\.[A-Za-z0-9_]+)+$")
        private val IPV4_ADDRESS = Regex("^\\d{1,3}(\\.\\d{1,3}){3}$")

        private fun isSafeHttpsUrl(value: String): Boolean = try {
            val uri = URI(value)
            val host = uri.host
            uri.scheme.equals("https", ignoreCase = true) &&
                !host.isNullOrBlank() &&
                uri.userInfo == null &&
                !IPV4_ADDRESS.matches(host) &&
                !host.contains(":")
        } catch (_: Exception) {
            false
        }

        val safeDefault = LauncherPolicy(
            policyId = "unmanaged",
            policyVersion = 0,
            mode = "DEFAULT_SCHOOL",
            approvedApps = emptyList(),
            webShortcuts = emptyList(),
            showMessages = false,
            showSupportContact = true,
            language = "en",
            offlineResources = emptyList(),
        )
    }
}

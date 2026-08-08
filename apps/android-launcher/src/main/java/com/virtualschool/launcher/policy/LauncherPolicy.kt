package com.virtualschool.launcher.policy

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
    val offlineResources: List<OfflineLessonResource> = emptyList(),
) {
    fun safeApprovedApps(): List<ApprovedApp> = approvedApps
        .filter { it.name.isNotBlank() && PACKAGE_NAME.matches(it.packageId) }
        .distinctBy { it.packageId }

    fun safeWebShortcuts(): List<WebShortcut> = webShortcuts
        .filter { shortcut ->
            shortcut.title.isNotBlank() &&
                (shortcut.url.startsWith("https://") || shortcut.url.startsWith("http://"))
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

        val safeDefault = LauncherPolicy(
            policyId = "unmanaged",
            policyVersion = 0,
            mode = "DEFAULT_SCHOOL",
            approvedApps = emptyList(),
            webShortcuts = emptyList(),
            showMessages = false,
            showSupportContact = true,
            offlineResources = emptyList(),
        )
    }
}

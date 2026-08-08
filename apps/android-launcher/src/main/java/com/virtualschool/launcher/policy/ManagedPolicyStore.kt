package com.virtualschool.launcher.policy

import android.content.Context
import android.content.RestrictionsManager
import android.os.Bundle
import org.json.JSONArray
import org.json.JSONObject

class ManagedPolicyStore(private val context: Context) {
    private val preferences = context.getSharedPreferences("launcher-policy", Context.MODE_PRIVATE)

    fun current(): LauncherPolicy {
        val restrictions = context.getSystemService(RestrictionsManager::class.java)
            ?.applicationRestrictions
            ?: Bundle.EMPTY
        val managed = fromBundle(restrictions)

        if (managed != null) {
            preferences.edit().putString(CACHED_POLICY, encode(managed)).apply()
            return managed
        }

        return preferences.getString(CACHED_POLICY, null)
            ?.let(::decode)
            ?: LauncherPolicy.safeDefault
    }

    private fun fromBundle(bundle: Bundle): LauncherPolicy? {
        val policyId = bundle.getString("policyId")?.takeIf(String::isNotBlank) ?: return null
        return LauncherPolicy(
            policyId = policyId,
            policyVersion = bundle.getInt("policyVersion", 0),
            mode = bundle.getString("mode", "DEFAULT_SCHOOL"),
            approvedApps = bundle.getString("approvedAppsJson", "[]").let(::appsFromJson),
            webShortcuts = bundle.getString("webShortcutsJson", "[]").let(::shortcutsFromJson),
            showMessages = bundle.getBoolean("showMessages", false),
            showSupportContact = bundle.getBoolean("showSupportContact", true),
            offlineResources = bundle.getString("offlineLessonsJson", "[]").let(::offlineFromJson),
        )
    }

    private fun encode(policy: LauncherPolicy): String = JSONObject()
        .put("policyId", policy.policyId)
        .put("policyVersion", policy.policyVersion)
        .put("mode", policy.mode)
        .put("approvedApps", JSONArray().apply {
            policy.approvedApps.forEach { put(JSONObject().put("name", it.name).put("packageId", it.packageId)) }
        })
        .put("webShortcuts", JSONArray().apply {
            policy.webShortcuts.forEach { put(JSONObject().put("title", it.title).put("url", it.url)) }
        })
        .put("showMessages", policy.showMessages)
        .put("showSupportContact", policy.showSupportContact)
        .put("offlineResources", JSONArray().apply {
            policy.offlineResources.forEach { item ->
                put(JSONObject()
                    .put("id", item.id).put("title", item.title).put("type", item.type)
                    .put("url", item.url).put("version", item.version).put("sha256", item.sha256)
                    .put("sizeBytes", item.sizeBytes).put("expiresAtEpochMillis", item.expiresAtEpochMillis))
            }
        })
        .toString()

    private fun decode(raw: String): LauncherPolicy? = runCatching {
        val json = JSONObject(raw)
        LauncherPolicy(
            policyId = json.getString("policyId"),
            policyVersion = json.optInt("policyVersion"),
            mode = json.optString("mode", "DEFAULT_SCHOOL"),
            approvedApps = appsFromArray(json.optJSONArray("approvedApps") ?: JSONArray()),
            webShortcuts = shortcutsFromArray(json.optJSONArray("webShortcuts") ?: JSONArray()),
            showMessages = json.optBoolean("showMessages"),
            showSupportContact = json.optBoolean("showSupportContact", true),
            offlineResources = offlineFromArray(json.optJSONArray("offlineResources") ?: JSONArray()),
        )
    }.getOrNull()

    private fun appsFromJson(raw: String): List<ApprovedApp> = runCatching {
        appsFromArray(JSONArray(raw))
    }.getOrDefault(emptyList())

    private fun appsFromArray(array: JSONArray): List<ApprovedApp> = buildList {
        repeat(array.length()) { index ->
            array.optJSONObject(index)?.let { item ->
                add(ApprovedApp(item.optString("name"), item.optString("packageId")))
            }
        }
    }

    private fun shortcutsFromJson(raw: String): List<WebShortcut> = runCatching {
        shortcutsFromArray(JSONArray(raw))
    }.getOrDefault(emptyList())

    private fun offlineFromJson(raw: String): List<OfflineLessonResource> = runCatching {
        offlineFromArray(JSONArray(raw))
    }.getOrDefault(emptyList())

    private fun offlineFromArray(array: JSONArray): List<OfflineLessonResource> = buildList {
        repeat(array.length()) { index ->
            array.optJSONObject(index)?.let { item ->
                add(OfflineLessonResource(
                    item.optString("id"), item.optString("title"), item.optString("type"),
                    item.optString("url"), item.optInt("version"), item.optString("sha256"),
                    item.optLong("sizeBytes"), item.optLong("expiresAtEpochMillis").takeIf { value -> value > 0 },
                ))
            }
        }
    }

    private fun shortcutsFromArray(array: JSONArray): List<WebShortcut> = buildList {
        repeat(array.length()) { index ->
            array.optJSONObject(index)?.let { item ->
                add(WebShortcut(item.optString("title"), item.optString("url")))
            }
        }
    }

    private companion object {
        const val CACHED_POLICY = "last-known-policy"
    }
}

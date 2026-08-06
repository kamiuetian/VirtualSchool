package com.virtualschool.browser.policy

import android.content.Context
import android.content.RestrictionsManager
import android.os.Bundle
import org.json.JSONArray
import org.json.JSONObject

class ManagedBrowserPolicyStore(private val context: Context) {
    private val preferences = context.getSharedPreferences("browser-policy", Context.MODE_PRIVATE)

    fun current(): BrowserPolicy {
        val restrictions = context.getSystemService(RestrictionsManager::class.java)
            ?.applicationRestrictions ?: Bundle.EMPTY
        val managed = fromBundle(restrictions)
        if (managed != null) {
            preferences.edit().putString(CACHED_POLICY, encode(managed)).apply()
        }
        val cached = preferences.getString(CACHED_POLICY, null)?.let(::decode)
        return BrowserPolicyResolver.resolve(managed, cached)
    }

    private fun fromBundle(bundle: Bundle): BrowserPolicy? {
        val policyId = bundle.getString("policyId")?.takeIf(String::isNotBlank) ?: return null
        return BrowserPolicy(
            policyId = policyId,
            policyVersion = bundle.getInt("policyVersion", 0).coerceAtLeast(0),
            defaultWebAccess = accessMode(bundle.getString("defaultWebAccess")),
            urlAllowlist = stringList(bundle.getString("urlAllowlistJson", "[]")),
            urlBlocklist = stringList(bundle.getString("urlBlocklistJson", "[]")),
            homeUrl = bundle.getString("homeUrl")?.takeIf(String::isNotBlank),
        )
    }

    private fun encode(policy: BrowserPolicy) = JSONObject()
        .put("policyId", policy.policyId)
        .put("policyVersion", policy.policyVersion)
        .put("defaultWebAccess", policy.defaultWebAccess.name)
        .put("urlAllowlist", JSONArray(policy.urlAllowlist))
        .put("urlBlocklist", JSONArray(policy.urlBlocklist))
        .put("homeUrl", policy.homeUrl)
        .toString()

    private fun decode(raw: String): BrowserPolicy? = runCatching {
        val json = JSONObject(raw)
        BrowserPolicy(
            policyId = json.getString("policyId"),
            policyVersion = json.optInt("policyVersion").coerceAtLeast(0),
            defaultWebAccess = accessMode(json.optString("defaultWebAccess")),
            urlAllowlist = stringList(json.optJSONArray("urlAllowlist") ?: JSONArray()),
            urlBlocklist = stringList(json.optJSONArray("urlBlocklist") ?: JSONArray()),
            homeUrl = json.optString("homeUrl").takeIf(String::isNotBlank),
        )
    }.getOrNull()

    private fun accessMode(value: String?): WebAccessMode =
        WebAccessMode.entries.firstOrNull { it.name == value } ?: WebAccessMode.DENY

    private fun stringList(raw: String): List<String> = runCatching { stringList(JSONArray(raw)) }
        .getOrDefault(emptyList())

    private fun stringList(array: JSONArray): List<String> = buildList {
        repeat(array.length()) { index -> array.optString(index).trim().takeIf(String::isNotEmpty)?.let(::add) }
    }.distinct()

    private companion object { const val CACHED_POLICY = "last-known-policy" }
}

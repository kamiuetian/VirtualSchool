package com.virtualschool.launcher.policy

import java.io.File
import java.net.URL
import java.security.MessageDigest

class OfflineLessonCache(private val root: File) {
    fun reconcile(resources: List<OfflineLessonResource>, nowMillis: Long = System.currentTimeMillis()) {
        root.mkdirs()
        val permitted = resources
            .filter { it.expiresAtEpochMillis == null || it.expiresAtEpochMillis > nowMillis }
            .map { fileName(it) }
            .toSet()
        root.listFiles()?.filter { it.isFile && it.name !in permitted }?.forEach(File::delete)
    }

    fun cached(resources: List<OfflineLessonResource>, nowMillis: Long = System.currentTimeMillis()) =
        resources.filter { resource ->
            (resource.expiresAtEpochMillis == null || resource.expiresAtEpochMillis > nowMillis) &&
                valid(resource, file(resource))
        }

    fun refresh(resources: List<OfflineLessonResource>, nowMillis: Long = System.currentTimeMillis()) {
        reconcile(resources, nowMillis)
        resources
            .filter { it.expiresAtEpochMillis == null || it.expiresAtEpochMillis > nowMillis }
            .filterNot { valid(it, file(it)) }
            .forEach { resource ->
                runCatching {
                    require(resource.url.startsWith("https://"))
                    URL(resource.url).openStream().use { cacheBytes(resource, it.readBytes()) }
                }
            }
    }

    fun cacheBytes(resource: OfflineLessonResource, bytes: ByteArray): Boolean {
        if (bytes.size.toLong() != resource.sizeBytes || sha256(bytes) != resource.sha256.lowercase()) return false
        root.mkdirs()
        val target = file(resource)
        val temporary = File(root, "${target.name}.part")
        temporary.writeBytes(bytes)
        if (target.exists()) target.delete()
        return temporary.renameTo(target)
    }

    private fun valid(resource: OfflineLessonResource, file: File): Boolean =
        file.isFile && file.length() == resource.sizeBytes && sha256(file.readBytes()) == resource.sha256.lowercase()

    private fun file(resource: OfflineLessonResource) = File(root, fileName(resource))
    private fun fileName(resource: OfflineLessonResource) =
        "${resource.id.replace(Regex("[^A-Za-z0-9_-]"), "_")}-${resource.version}.lesson"

    private fun sha256(bytes: ByteArray) = MessageDigest.getInstance("SHA-256")
        .digest(bytes)
        .joinToString("") { "%02x".format(it) }
}

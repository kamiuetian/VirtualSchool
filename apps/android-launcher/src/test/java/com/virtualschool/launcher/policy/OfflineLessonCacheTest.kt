package com.virtualschool.launcher.policy

import java.nio.file.Files
import java.security.MessageDigest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class OfflineLessonCacheTest {
    @Test fun `accepts only content matching integrity metadata`() {
        val root = Files.createTempDirectory("lesson-cache").toFile()
        val bytes = "approved lesson".toByteArray()
        val resource = resource(bytes)
        val cache = OfflineLessonCache(root)

        assertFalse(cache.cacheBytes(resource, "tampered".toByteArray()))
        assertTrue(cache.cacheBytes(resource, bytes))
        assertEquals(listOf(resource), cache.cached(listOf(resource)))
    }

    @Test fun `authoritative reconciliation removes revoked and expired files`() {
        val root = Files.createTempDirectory("lesson-cache").toFile()
        val bytes = "approved lesson".toByteArray()
        val resource = resource(bytes)
        val cache = OfflineLessonCache(root)
        assertTrue(cache.cacheBytes(resource, bytes))

        cache.reconcile(emptyList())
        assertTrue(root.listFiles().orEmpty().isEmpty())

        val expired = resource.copy(expiresAtEpochMillis = 1)
        assertTrue(cache.cacheBytes(expired, bytes))
        cache.reconcile(listOf(expired), nowMillis = 2)
        assertTrue(root.listFiles().orEmpty().isEmpty())
    }

    private fun resource(bytes: ByteArray) = OfflineLessonResource(
        "lesson-1", "Fractions", "PDF", "https://cdn.school.test/fractions.pdf", 2,
        MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) },
        bytes.size.toLong(), null,
    )
}

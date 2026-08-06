package com.virtualschool.browser

import org.junit.Assert.assertEquals
import org.junit.Test

class BlockedEventReporterTest {
    @Test
    fun reportsOnlyNormalizedDomainFromBlockedUrl() {
        assertEquals(
            "learning.example.edu",
            QueuedBlockedEventReporter.domain("https://Learning.Example.EDU/private/path?student=1"),
        )
        assertEquals("invalid", QueuedBlockedEventReporter.domain("not a url"))
    }
}

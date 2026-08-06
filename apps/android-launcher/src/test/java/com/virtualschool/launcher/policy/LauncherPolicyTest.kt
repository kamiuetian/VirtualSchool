package com.virtualschool.launcher.policy

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class LauncherPolicyTest {
    @Test
    fun exposesOnlyValidUniqueApprovedApps() {
        val policy = sample(
            apps = listOf(
                ApprovedApp("Classroom", "com.google.classroom"),
                ApprovedApp("Duplicate", "com.google.classroom"),
                ApprovedApp("Unsafe", "not a package"),
            ),
        )

        assertEquals(listOf("com.google.classroom"), policy.safeApprovedApps().map { it.packageId })
    }

    @Test
    fun exposesOnlyHttpLearningLinks() {
        val policy = sample(
            shortcuts = listOf(
                WebShortcut("Math", "https://math.example.edu"),
                WebShortcut("Unsafe", "javascript:alert(1)"),
            ),
        )

        assertEquals(listOf("Math"), policy.safeWebShortcuts().map { it.title })
    }

    @Test
    fun identifiesLostDeviceModeAndFormatsModeName() {
        val policy = sample(mode = "LOST_DEVICE")

        assertTrue(policy.isLostMode)
        assertEquals("Lost Device", policy.displayMode())
    }

    private fun sample(
        apps: List<ApprovedApp> = emptyList(),
        shortcuts: List<WebShortcut> = emptyList(),
        mode: String = "DEFAULT_SCHOOL",
    ) = LauncherPolicy("policy-1", 3, mode, apps, shortcuts, true, true)
}

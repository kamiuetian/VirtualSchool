package com.virtualschool.launcher.policy

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class LauncherStringsTest {
    @Test fun hasEveryUrduCoreString() = assertTrue(LauncherStrings.missingUrduKeys().isEmpty())
    @Test fun unsupportedLanguageFallsBackToEnglish() = assertEquals("Approved apps", LauncherStrings.text("fr", "approvedApps"))
}

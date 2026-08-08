package com.virtualschool.launcher.policy

object LauncherStrings {
    private val english = mapOf("approvedApps" to "Approved apps", "learningLinks" to "Learning links", "offlineMode" to "Offline Mode", "noApps" to "No apps are available in this mode.", "noLessons" to "No verified lessons are available offline.", "managedDevice" to "This device is managed by your school. Please return it to school staff.", "messages" to "School messages are enabled for this device.", "support" to "Need help? Contact your school support team.", "mode" to "Mode", "policy" to "Policy")
    private val urdu = mapOf("approvedApps" to "منظور شدہ ایپس", "learningLinks" to "تعلیمی روابط", "offlineMode" to "آف لائن موڈ", "noApps" to "اس موڈ میں کوئی ایپ دستیاب نہیں۔", "noLessons" to "کوئی تصدیق شدہ سبق آف لائن دستیاب نہیں۔", "managedDevice" to "یہ آلہ آپ کے اسکول کے زیر انتظام ہے۔ براہ کرم اسے اسکول کے عملے کو واپس کریں۔", "messages" to "اس آلے کے لیے اسکول کے پیغامات فعال ہیں۔", "support" to "مدد چاہیے؟ اپنے اسکول کی سپورٹ ٹیم سے رابطہ کریں۔", "mode" to "موڈ", "policy" to "پالیسی")
    fun text(language: String, key: String): String = if (language == "ur") urdu[key] ?: english.getValue(key) else english.getValue(key)
    fun missingUrduKeys(): Set<String> = english.keys - urdu.keys
}

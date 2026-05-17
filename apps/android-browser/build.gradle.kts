plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.virtualschool.browser"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.virtualschool.browser"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0"
    }
}

dependencies {
    testImplementation("junit:junit:4.13.2")
}

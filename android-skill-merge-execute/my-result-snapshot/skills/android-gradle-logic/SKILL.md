---
name: android-gradle-logic
description: Use when setting up or refactoring Android Gradle build logic — convention plugins, composite builds, version catalogs, and shared build configuration across modules.
---

# Android Gradle Build Logic

Centralise build configuration in reusable **Convention Plugins** inside a `build-logic/` composite build, so each module's `build.gradle.kts` collapses to `plugins { alias(libs.plugins.myapp.android.library) }` plus a `namespace`.

The canonical worked example is **[nowinandroid's `build-logic/`](https://github.com/android/nowinandroid/tree/main/build-logic)** — start from it rather than hand-rolling. This skill covers the three wiring details that are easy to get wrong, plus the AGP 9 deltas.

## The wiring gotchas

**1. `build-logic` does NOT inherit the root version catalog — recreate it.** A composite build has its own `settings.gradle.kts`; the root `libs` catalog is invisible inside `build-logic` until you declare it. Without this the convention plugins can't reference `libs.*` and won't compile:

```kotlin
// build-logic/settings.gradle.kts
dependencyResolutionManagement {
    versionCatalogs {
        create("libs") { from(files("../gradle/libs.versions.toml")) }
    }
}
```

**2. Declare the convention-plugin ids in `[plugins]` with `version = "unspecified"`** — otherwise `alias(libs.plugins.myapp.android.library)` in a module file doesn't resolve (Gradle treats it as a versioned external plugin and fails to find it). The `id` here must match the one you `register(...)`:

```toml
# gradle/libs.versions.toml
[plugins]
myapp-android-application = { id = "myapp.android.application", version = "unspecified" }
myapp-android-library     = { id = "myapp.android.library", version = "unspecified" }
myapp-android-compose     = { id = "myapp.android.compose", version = "unspecified" }
```

**3. Set the JVM toolchain via Kotlin's extension, not `JavaPluginExtension`.** AGP's `com.android.application` / `com.android.library` plugins do **not** apply Gradle's `java` plugin, so `configure<JavaPluginExtension> { ... }` throws *"Extension of type JavaPluginExtension does not exist"* and fails configuration in every module. Use the Kotlin extension inside the convention plugin:

```kotlin
extensions.configure<org.jetbrains.kotlin.gradle.dsl.KotlinAndroidProjectExtension> {
    jvmToolchain(21)
}
// equivalently: kotlin { jvmToolchain(21) }
```

## AGP 9 Implications

The convention plugin pattern above targets AGP 8. AGP 9 changes several things that hit build logic directly: it drops the standalone `org.jetbrains.kotlin.android` plugin (Kotlin is built into `com.android.application` / `com.android.library`), removes `BaseExtension` and the old variant APIs (`applicationVariants` → `androidComponents { onVariants { … } }`), moves `kotlinOptions {}` to a top-level `kotlin { compilerOptions { … } }`, and makes `kapt` incompatible (migrate to KSP). Any convention plugin that touches these needs updating.

**A KMP module (`org.jetbrains.kotlin.multiplatform` + Android target) can no longer use `com.android.library` on AGP 9** — AGP's "built-in Kotlin" makes the two plugins incompatible and configuration fails with *"the 'com.android.library' ... plugin is not compatible with the 'org.jetbrains.kotlin.multiplatform' plugin since AGP 9.0"*. Use **`com.android.kotlin.multiplatform.library`** instead, and move Android config (`namespace`, `compileSdk`, `minSdk`) inside the `kotlin { androidLibrary { ... } }` block rather than a separate top-level `android { ... }` block:

```kotlin
// shared/build.gradle.kts — AGP 9, Android target inside a KMP module
plugins {
    alias(libs.plugins.kotlin.multiplatform)
    alias(libs.plugins.android.kotlin.multiplatform.library) // NOT com.android.library
}
kotlin {
    androidLibrary {
        namespace = "com.example.shared"
        compileSdk = 36
        minSdk = 24
    }
    sourceSets { /* commonMain, androidMain, ... */ }
}
```
Register this plugin id (`com.android.kotlin.multiplatform.library`, same `version.ref` as the rest of AGP) in the root `build.gradle.kts` plugins block with `apply false`, same as `android-application`/`android-library` — applying it directly in the module without that root declaration can fail with *"plugin is already on the classpath with an unknown version"*.

Defer to the dedicated migration skills for the mechanics rather than duplicating the steps here: Google's [`agp-9-upgrade`](https://github.com/android/skills/tree/main/agp-9-upgrade) for pure-Android projects, JetBrains' [`kotlin-tooling-agp9-migration`](https://github.com/Kotlin/kotlin-agent-skills/tree/main/skills/kotlin-tooling-agp9-migration) for KMP, and this repo's `gradle-build-performance` skill for the kapt → KSP step.

## Worked Version Catalog example (Koin + Ktor house defaults)

A concrete `libs.versions.toml` showing `[versions]` / `[libraries]` / `[bundles]` / `[plugins]` together, using this repo's default DI (Koin) and networking (Ktor) stack:

```toml
# gradle/libs.versions.toml
[versions]
agp = "8.2.2"
kotlin = "1.9.22"
ksp = "1.9.22-1.0.17"
compose-compiler = "1.5.10"
compose-bom = "2024.02.00"
coroutines = "1.8.0"
koin = "3.5.3"
ktor = "2.3.8"

[libraries]
# Compose BOM
compose-bom = { module = "androidx.compose:compose-bom", version.ref = "compose-bom" }
compose-ui = { module = "androidx.compose.ui:ui" }
compose-material3 = { module = "androidx.compose.material3:material3" }
compose-ui-tooling = { module = "androidx.compose.ui:ui-tooling" }

# Koin
koin-android = { module = "io.insert-koin:koin-android", version.ref = "koin" }
koin-compose = { module = "io.insert-koin:koin-androidx-compose", version.ref = "koin" }

# Ktor Client
ktor-client-core = { module = "io.ktor:ktor-client-core", version.ref = "ktor" }
ktor-client-okhttp = { module = "io.ktor:ktor-client-okhttp", version.ref = "ktor" }
ktor-client-content-negotiation = { module = "io.ktor:ktor-client-content-negotiation", version.ref = "ktor" }
ktor-serialization-json = { module = "io.ktor:ktor-serialization-kotlinx-json", version.ref = "ktor" }

# Testing
junit5 = { module = "org.junit.jupiter:junit-jupiter", version = "5.10.0" }
mockk = { module = "io.mockk:mockk", version = "1.13.8" }
turbine = { module = "app.cash.turbine:turbine", version = "1.0.0" }
coroutines-test = { module = "org.jetbrains.kotlinx:kotlinx-coroutines-test", version.ref = "coroutines" }

[bundles]
compose = ["compose-ui", "compose-material3", "compose-ui-tooling"]
ktor = ["ktor-client-core", "ktor-client-okhttp", "ktor-client-content-negotiation", "ktor-serialization-json"]
testing = ["junit5", "mockk", "turbine", "coroutines-test"]

[plugins]
android-application = { id = "com.android.application", version.ref = "agp" }
android-library = { id = "com.android.library", version.ref = "agp" }
kotlin-android = { id = "org.jetbrains.kotlin.android", version.ref = "kotlin" }
```

Use the bundles from a feature module like:

```kotlin
dependencies {
    implementation(project(":core:common"))
    implementation(project(":core:ui"))

    implementation(libs.bundles.compose)
    implementation(libs.koin.compose)

    testImplementation(libs.bundles.testing)
}
```

## Multi-module structure example

```kotlin
// settings.gradle.kts
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

include(":app")
include(":core:common")
include(":core:ui")
include(":core:network")
include(":feature:home")
include(":feature:detail")
```

## Checklist

- [ ] `build-logic` included as a composite build (`includeBuild("build-logic")`) in the root `settings.gradle.kts`
- [ ] `build-logic/settings.gradle.kts` recreates the `libs` catalog via `from(files("../gradle/libs.versions.toml"))`
- [ ] Convention plugins `register`-ed with stable ids **and** declared in `[plugins]` with `version = "unspecified"`
- [ ] JVM toolchain set via `KotlinAndroidProjectExtension` / `kotlin { jvmToolchain() }`, never `JavaPluginExtension`
- [ ] `compileSdk` / `minSdk` / Compose set once in the plugins, not per module

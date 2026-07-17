---
name: kmp-ktor
description: Use when setting up or working with Ktor client in KMP or Android projects — HttpClient configuration, per-platform engine selection, kotlinx.serialization, bearer auth with refresh, MockEngine testing, and error mapping at the repository boundary.
---

# Ktor Client for KMP and Android

This reference covers the Ktor client configuration traps — plugin install order, serialization flags, auth refresh, and error mapping — not the basics of a shared `HttpClient`, engine selection, or `ContentNegotiation` setup. **Related:** `android-skills:android-data-layer` (repository + the `DataError` error model — its canonical home), `android-skills:android-retrofit` (Android-only equivalent).

## Plugin install order — `HttpRequestRetry` BEFORE `HttpTimeout`

The install order most often gotten wrong: installing `HttpTimeout` before `HttpRequestRetry`. Plugins run in install order for outgoing requests; retries must be able to catch timeout errors, so retry has to wrap timeout.

```kotlin
val json = Json { ignoreUnknownKeys = true; coerceInputValues = true; encodeDefaults = true }  // encodeDefaults: see the section below

HttpClient(engine) {
    install(ContentNegotiation) { json(json) }
    install(Auth) { bearer { /* loadTokens / refreshTokens */ } }
    install(HttpRequestRetry) {                 // BEFORE HttpTimeout
        retryOnServerErrors(maxRetries = 3)
        exponentialDelay()
    }
    install(HttpTimeout) {                       // AFTER HttpRequestRetry
        requestTimeoutMillis = 30_000; connectTimeoutMillis = 15_000; socketTimeoutMillis = 15_000
    }
}
```

Reversed, `HttpTimeout` resolves the request as failed before the retry plugin sees it, so timeouts are never retried. (Separately, the `Auth` plugin handles 401 refresh independently — let `HttpRequestRetry` cover transient/5xx failures; don't chain the two around the same status code.)

## `encodeDefaults = true` — or protocol-constant fields silently vanish

`kotlinx.serialization` defaults to `encodeDefaults = false`, which **strips any property whose value equals its declared default** from the serialized output. A `jsonrpc: String = "2.0"` (or `version = "1.0"`, `type = "..."`) disappears from the payload; the server rejects every request with a generic "invalid request," and the fix is a one-line flag — found only after hours chasing HTTP-layer red herrings. Always set it for client APIs — the `val json` defined at the top of this file does, alongside `ignoreUnknownKeys` and `coerceInputValues`. That one configured instance is what the whole client shares: `install(ContentNegotiation) { json(json) }` and the WebSocket converter both take it.

## `expectSuccess` — pick one model, consistently

`expectSuccess = true` makes Ktor throw `ClientRequestException` (4xx) / `ServerResponseException` (5xx) on non-2xx — and that throw **runs before any manual status check**, so an `if (response.status == OK)` branch after it is dead code. Pick one model project-wide: `expectSuccess = true` + `try/catch` (matches the repository pattern), or `expectSuccess = false` + explicit `response.status.isSuccess()` inspection. Never mix them.

## Bearer refresh — `markAsRefreshTokenRequest()` or it loops

In the `Auth` `bearer { refreshTokens { … } }` block, mark the refresh POST with `markAsRefreshTokenRequest()` so it isn't intercepted by the same `Auth` plugin — without it, a failing refresh triggers another refresh, looping infinitely. It's an `HttpRequestBuilder` extension: call it **inside the request builder block**, not bare in `refreshTokens { }` (where it doesn't compile).

```kotlin
install(Auth) {
    bearer {
        loadTokens { tokenStorage.getTokens()?.let { BearerTokens(it.access, it.refresh) } }
        refreshTokens {
            val refresh = oldTokens?.refreshToken ?: return@refreshTokens null
            val r = client.post("auth/refresh") {
                markAsRefreshTokenRequest()                      // skip the Auth plugin for this call
                setBody(RefreshRequestDto(refresh))
            }.body<TokenResponseDto>()
            tokenStorage.save(r.accessToken, r.refreshToken); BearerTokens(r.accessToken, r.refreshToken)
        }
        sendWithoutRequest { it.url.pathSegments.none { seg -> seg in listOf("login", "register") } }
    }
}
```

Keep `BearerTokens` at the plugin boundary; the rest of the app uses your own token type. `TokenStorage` is project-defined (DataStore on Android/JVM, Keychain on iOS).

## WebSockets & SSE — use the serialization converter

For real-time transports, install the kotlinx-serialization converter so typed messages flow over the same `Json` config as `ContentNegotiation`; without it you hand-encode/decode `Frame.Text`. (SSE = server→client only, plain HTTP, built-in reconnect; WebSocket = bidirectional, manual reconnect, binary frames — default to SSE when the client only consumes.)

```kotlin
val client = HttpClient(engine) {
    install(WebSockets) {
        pingIntervalMillis = 30_000
        contentConverter = KotlinxWebsocketSerializationConverter(json)  // the shared configured instance — bare `Json` reverts to encodeDefaults = false
    }
    install(SSE)
}

client.webSocket("wss://api.example.com/ws") {
    sendSerialized(SubscribeMessage(topic = "items"))
    while (true) { val msg = receiveDeserialized<ServerMessage>(); /* handle */ }
}

// SSE — incoming is a Flow<ServerSentEvent>
client.sse("https://api.example.com/events") { incoming.collect { event -> /* event.event / event.data / event.id */ } }
```

Wrap SSE/WebSocket collection in a `LaunchedEffect` or repository coroutine so cancellation closes the HTTP connection when the consumer goes away.

## Error mapping + testing

Catch **specific** Ktor types at the repository (`ClientRequestException` / `ServerResponseException` / `HttpRequestTimeoutException` / `IOException`) and map to `DataError` — `catch (e: Exception)` would swallow `CancellationException`. The full repository pattern + `DataError` taxonomy lives in `android-skills:android-data-layer`. For richer per-error UI states (`Unauthorized`, `RateLimited`, `Forbidden`, …), a sealed `ApiResult<T>` + a `safeRequest` wrapper with `expectSuccess = false` is the alternative shape — pick one per project.

Inject `HttpClientEngine` so tests swap in `MockEngine`, reusing the production `createHttpClient` factory so plugin config matches:

```kotlin
val mockEngine = MockEngine { request ->
    assertEquals("/users/42", request.url.encodedPath)
    respond("""{"id":"42","name":"Ada","created_at":1700000000000}""",
        HttpStatusCode.OK, headersOf(HttpHeaders.ContentType, "application/json"))
}
val repo = UserRepository(UserService(createHttpClient(mockEngine, baseUrl = "https://api.example.com/")))
```

## Salvaged from `ktor-patterns` / `kmp-networking` (merged during networking-cluster consolidation)

The two skills below were deleted as standalone skills and folded into this one; each subsection below is one salvaged pattern.

### Certificate pinning (from `ktor-patterns`)

Pin the OkHttp engine's TLS certificate and always include a backup pin — without one, rotating the leaf cert bricks every installed client until they update:

```kotlin
val client = HttpClient(OkHttp) {
    engine {
        config {
            certificatePinner(
                CertificatePinner.Builder()
                    .add("api.example.com", "sha256/AAAA...")
                    .add("api.example.com", "sha256/BBBB...")  // Backup pin — keep this current, e.g. the CA intermediate
                    .build()
            )
        }
    }
}
```

### Request interceptor for per-request headers (from `ktor-patterns`)

Use the `HttpSend` plugin to attach headers to every outgoing request without touching each call site:

```kotlin
val client = HttpClient(OkHttp) {
    install(HttpSend) {
        intercept { request ->
            request.headers.append("X-Client-Version", BuildConfig.VERSION_NAME)
            execute(request)
        }
    }
}
```

### Per-platform engine factory recipes (from `kmp-networking`)

**Android — OkHttp engine with a 10MB disk cache:**

```kotlin
// androidMain/kotlin/network/OkHttpEngineFactory.kt
fun createOkhttpEngine(context: Context): OkHttpEngine {
    val config = OkHttpConfig {
        preconfigured = OkHttpClient.Builder()
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .writeTimeout(30, TimeUnit.SECONDS)
            .cache(
                Cache(
                    File(context.cacheDir, "http_cache"),
                    10 * 1024 * 1024 // 10MB
                )
            )
            .build()
    }
    return OkHttpEngine(config)
}
```

**iOS — Darwin engine:**

```kotlin
// iosMain/kotlin/network/DarwinEngineFactory.kt
fun createDarwinEngine(): DarwinEngine {
    val config = DarwinClientConfig {
        configureSession {
            setAllowsCellularAccess(true)
            setTimeoutIntervalForRequest(30.0)
            setTimeoutIntervalForResource(60.0)

            URLCache(
                sharedCacheDirectory,
                10 * 1024 * 1024 // 10MB
            ).let { URLCache.setSharedURLCache(it) }
        }
    }
    return DarwinEngine(config)
}
```

### Network error taxonomy + mapper (from `kmp-networking`)

> **Naming note:** the source skill called this `NetworkException` with a bare `Throwable.toNetworkException()` mapper. Renamed here to extend the repo's canonical `DataError` sealed type (see `android-skills:android-data-layer`) instead of introducing a second, parallel error hierarchy — and specifically *not* named `Result`, to avoid shadowing `kotlin.Result`. `DataError` is a placeholder for whatever exact shared error type the data-layer cluster settles on; reconcile the `Network` subtype below with that type's real definition.

```kotlin
// commonMain/kotlin/network/DataError.kt
sealed class DataError(message: String, cause: Throwable? = null) : Exception(message, cause) {
    sealed class Network(message: String, cause: Throwable? = null) : DataError(message, cause) {
        object Unauthorized : Network("User not authenticated")
        object Forbidden : Network("Access forbidden")
        object NotFound : Network("Resource not found")
        class Server(val code: Int) : Network("Server error $code")
        object Unavailable : Network("Network unavailable")
        object Timeout : Network("Request timeout")
    }
    class Local(cause: Throwable) : DataError("Local storage error", cause)
}

// Wrap Ktor/platform exceptions at the repository boundary
fun Throwable.toDataError(): DataError = when (this) {
    is DataError -> this
    is ClientRequestException -> when (response.status.value) {
        401 -> DataError.Network.Unauthorized
        403 -> DataError.Network.Forbidden
        404 -> DataError.Network.NotFound
        else -> DataError.Network.Server(response.status.value)
    }
    is ServerResponseException -> DataError.Network.Server(response.status.value)
    is HttpRequestTimeoutException -> DataError.Network.Timeout
    is IOException -> DataError.Network.Unavailable
    else -> DataError.Network.Server(0)
}
```

### Multipart file upload (from `kmp-networking`)

```kotlin
suspend fun uploadAvatar(userId: String, file: ByteArray): String {
    return client.submitFormWithBinaryData(
        url = "https://api.example.com/users/$userId/avatar",
        formData = formData {
            append("avatar", file, Headers.build {
                append(HttpHeaders.ContentDisposition, "filename=avatar.jpg")
            })
        }
    ).body()
}
```

### Manual exponential-backoff retry helper (from `kmp-networking`)

The `HttpRequestRetry` plugin above covers server-error/timeout retries declaratively. Keep this manual helper for call sites that need a custom retry predicate (e.g. only `DataError.Network.Unavailable` / `Timeout`, not every failure) or that aren't using the plugin:

```kotlin
// commonMain/kotlin/network/Retry.kt
suspend fun <T> retryApiCall(
    maxRetries: Int = 3,
    delayMs: Long = 1000,
    block: suspend () -> T
): T {
    var lastError: DataError? = null
    repeat(maxRetries) { attempt ->
        try {
            return block()
        } catch (e: Exception) {
            val error = e.toDataError()
            lastError = error
            if (error is DataError.Network.Unavailable || error is DataError.Network.Timeout) {
                if (attempt < maxRetries - 1) {
                    delay(delayMs * (attempt + 1)) // exponential backoff: 1x, 2x, 3x...
                }
            } else {
                throw error
            }
        }
    }
    throw lastError ?: DataError.Network.Server(0)
}
```

### Offline cache-with-TTL, stale-on-failure fallback (concept, from `kmp-networking`)

Concept, not exact code to copy: wrap a network call with a cache lookup so a fresh cached value short-circuits the network, and a network failure falls back to a *stale* cached value rather than surfacing an error.

1. Look up the cache entry for `key`. If present and `age <= ttl`, return it — skip the network call entirely.
2. Otherwise call the network. On success, write the result back into the cache with a fresh timestamp and return it.
3. On network failure, look up the cache entry again (even if stale) and return it instead of throwing; only propagate the error if there's no cached value at all.

```kotlin
suspend fun <R> withCache(key: String, ttl: Duration, block: suspend () -> R): R {
    cache.get<R>(key)?.let { cached ->
        if (cached.age <= ttl) return cached.data
    }
    return try {
        val result = block()
        cache.put(key, result)
        result
    } catch (e: Exception) {
        cache.get<R>(key)?.data ?: throw e.toDataError() // stale-on-failure fallback
    }
}
```

### Koin DI network-module wiring (from `kmp-networking`)

```kotlin
// commonMain/kotlin/di/NetworkModule.kt
val networkModule = module {
    single { createHttpClient(engine = get(), baseUrl = "https://api.example.com") }
    single { UserApi(get()) }
    single { AuthApi(get()) }
    factory { ConnectivityMonitor(get()) }
}
```

---
name: kmp-repositories
description: Repository pattern for Kotlin Multiplatform. Shared interfaces with platform-specific implementations, clean data layer architecture.
---

# KMP Repository Pattern

Implement the repository pattern with shared interfaces in `commonMain` and platform-specific implementations.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Presentation Layer                    │
│              (ViewModels, Composables, SwiftUI)          │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│                    Domain Layer                          │
│                    (Use Cases)                           │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│                    Data Layer                            │
│  ┌──────────────────────────────────────────────────┐   │
│  │         Repository Interface (commonMain)         │   │
│  └──────────────────────┬───────────────────────────┘   │
│                         │                               │
│  ┌──────────────────────▼───────────────────────────┐   │
│  │      Repository Implementation (commonMain)      │   │
│  │  - Coordinates data sources                      │   │
│  │  - Caching strategy                              │   │
│  │  - Error mapping                                 │   │
│  └──────────────────────┬───────────────────────────┘   │
│                         │                               │
│  ┌──────────────────────▼───────────────────────────┐   │
│  │              Data Sources                        │   │
│  │  ┌────────────┐  ┌────────────┐  ┌───────────┐  │   │
│  │  │   Remote   │  │   Local    │  │   Memory  │  │   │
│  │  │ (Network)  │  │ (Database) │  │  (Cache)  │  │   │
│  │  └────────────┘  └────────────┘  └───────────┘  │   │
│  └───────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────┘
```

## Repository Interface

```kotlin
// commonMain/kotlin/data/repository/UserRepository.kt
interface UserRepository {
    // Single shot
    suspend fun getUser(id: String): Result<User>
    suspend fun getUsers(page: Int): Result<PaginatedResponse<User>>
    suspend fun saveUser(user: User): Result<User>
    suspend fun deleteUser(id: String): Result<Unit>

    // Streams
    fun observeUser(id: String): Flow<Result<User>>
    fun observeUsers(): Flow<Result<List<User>>>

    // Cache control
    suspend fun refreshUser(id: String): Result<User>
    suspend fun refreshAll(): Result<Unit>
    suspend fun clearCache(): Result<Unit>
}
```

## Base Repository

```kotlin
// commonMain/kotlin/data/repository/BaseRepository.kt
abstract class BaseRepository {
    // Execute with error handling
    protected suspend fun <T> execute(
        block: suspend () -> T
    ): Result<T> = try {
        Result.success(block())
    } catch (e: CancellationException) {
        throw e
    } catch (e: NetworkException) {
        Result.failure(e)
    } catch (e: Exception) {
        Result.failure(DataException(cause = e))
    }

    // Flow with error handling
    protected fun <T> flowResult(
        block: suspend () -> Flow<T>
    ): Flow<Result<T>> = flow {
        try {
            block().collect { emit(Result.success(it)) }
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            emit(Result.failure(e))
        }
    }

    // Cache-first strategy
    protected suspend fun <T> cacheFirst(
        cacheKey: String,
        ttl: Duration,
        cacheBlock: suspend () -> T?,
        networkBlock: suspend () -> T
    ): Result<T> = execute {
        // Try cache
        cacheBlock()?.let { return@execute it }

        // Fetch from network
        val result = networkBlock()

        // Update cache
        // saveToCache(cacheKey, result)

        result
    }

    // Network-first strategy
    protected suspend fun <T> networkFirst(
        cacheKey: String,
        cacheBlock: suspend () -> T?,
        networkBlock: suspend () -> T
    ): Result<T> = execute {
        try {
            // Try network first
            val result = networkBlock()
            // Update cache
            result
        } catch (e: NetworkException) {
            // Fall back to cache
            cacheBlock() ?: throw e
        }
    }

    // Refresh strategy
    protected suspend fun <T> refresh(
        networkBlock: suspend () -> T,
        cacheBlock: suspend (T) -> Unit
    ): Result<T> = execute {
        val result = networkBlock()
        cacheBlock(result)
        result
    }
}
```

## Concrete Repository

```kotlin
// commonMain/kotlin/data/repository/UserRepositoryImpl.kt
class UserRepositoryImpl(
    private val remoteDataSource: UserRemoteDataSource,
    private val localDataSource: UserLocalDataSource,
    private val memoryCache: MemoryCache,
    private val dispatcher: CoroutineDispatcher = PlatformDispatchers.io
) : BaseRepository(), UserRepository {

    override suspend fun getUser(id: String): Result<User> =
        networkFirst(
            cacheKey = "user:$id",
            cacheBlock = { localDataSource.getUser(id) },
            networkBlock = { remoteDataSource.getUser(id).also { user ->
                localDataSource.saveUser(user)
                memoryCache.put("user:$id", user)
            }}
        )

    override suspend fun getUsers(page: Int): Result<PaginatedResponse<User>> =
        execute {
            remoteDataSource.getUsers(page).also { response ->
                localDataSource.saveUsers(response.items)
            }
        }

    override suspend fun saveUser(user: User): Result<User> =
        execute {
            remoteDataSource.createUser(user).also { savedUser ->
                localDataSource.saveUser(savedUser)
                memoryCache.put("user:${savedUser.id}", savedUser)
            }
        }

    override suspend fun deleteUser(id: String): Result<Unit> =
        execute {
            remoteDataSource.deleteUser(id).also {
                localDataSource.deleteUser(id)
                memoryCache.remove("user:$id")
            }
        }

    override fun observeUser(id: String): Flow<Result<User>> =
        flowResult {
            localDataSource.observeUser(id)
        }

    override fun observeUsers(): Flow<Result<List<User>>> =
        flowResult {
            localDataSource.observeAllUsers()
        }

    override suspend fun refreshUser(id: String): Result<User> =
        refresh(
            networkBlock = { remoteDataSource.getUser(id) },
            cacheBlock = { user -> localDataSource.saveUser(user) }
        )

    override suspend fun refreshAll(): Result<Unit> =
        execute {
            remoteDataSource.getUsers(page = 1).items.forEach { user ->
                localDataSource.saveUser(user)
            }
        }

    override suspend fun clearCache(): Result<Unit> =
        execute {
            localDataSource.clearAll()
            memoryCache.clear()
        }
}
```

## Data Sources

### Remote Data Source

```kotlin
// commonMain/kotlin/data/datasource/remote/UserRemoteDataSource.kt
interface UserRemoteDataSource {
    suspend fun getUser(id: String): User
    suspend fun getUsers(page: Int): PaginatedResponse<User>
    suspend fun createUser(user: User): User
    suspend fun updateUser(id: String, user: User): User
    suspend fun deleteUser(id: String)
}

class UserRemoteDataSourceImpl(
    private val api: UserApi
) : UserRemoteDataSource {
    override suspend fun getUser(id: String): User = api.getUser(id)
    override suspend fun getUsers(page: Int): PaginatedResponse<User> = api.getUsers(page)
    override suspend fun createUser(user: User): User = api.createUser(user)
    override suspend fun updateUser(id: String, user: User): User = api.updateUser(id, user)
    override suspend fun deleteUser(id: String) = api.deleteUser(id)
}
```

### Local Data Source

```kotlin
// commonMain/kotlin/data/datasource/local/UserLocalDataSource.kt
interface UserLocalDataSource {
    suspend fun getUser(id: String): User?
    suspend fun getAllUsers(): List<User>
    suspend fun saveUser(user: User)
    suspend fun saveUsers(users: List<User>)
    suspend fun deleteUser(id: String)
    suspend fun clearAll()
    fun observeUser(id: String): Flow<User>
    fun observeAllUsers(): Flow<List<User>>
}
```

> The implementation of `UserLocalDataSourceImpl` depends on which storage library the project
> uses — Room and SQLDelight are two different, non-interchangeable libraries, and a single
> impl that mixes their APIs (e.g. calling `userQueries()` as a function — in real SQLDelight
> generated code, `userQueries` is a property, not a function) does not compile. Pick one:
>
> - **Room (KMP)** — follow the `@ConstructedBy` / `RoomDatabaseConstructor` `expect object`
>   recipe in the `android-data-layer` skill, and drive multi-statement writes through a
>   `@Transaction`-annotated suspend DAO function rather than a nonexistent `database.transaction { }`.
> - **SQLDelight** — follow the `sqldelight-patterns` skill, which uses `database.userQueries`
>   as a generated *property* (e.g. `database.userQueries.getById(id).executeAsOneOrNull()`)
>   and `database.transaction { }`, which *is* a real SQLDelight API (unlike Room, where it is not).

## Use Cases

```kotlin
// commonMain/kotlin/domain/usecase/GetUserUseCase.kt
class GetUserUseCase(
    private val repository: UserRepository
) {
    suspend operator fun invoke(id: String): Result<User> =
        repository.getUser(id)
}

// commonMain/kotlin/domain/usecase/ObserveUserUseCase.kt
class ObserveUserUseCase(
    private val repository: UserRepository
) {
    operator fun invoke(id: String): Flow<Result<User>> =
        repository.observeUser(id)
}

// commonMain/kotlin/domain/usecase/RefreshUserDataUseCase.kt
class RefreshUserDataUseCase(
    private val repository: UserRepository
) {
    suspend operator fun invoke(id: String): Result<User> =
        repository.refreshUser(id)
}
```

## Dependency Injection

```kotlin
// commonMain/kotlin/di/DataModule.kt
val dataModule = module {
    // Data sources
    single { UserApi(get()) }
    single<UserRemoteDataSource> { UserRemoteDataSourceImpl(get()) }

    // Local data source
    single { createDatabase(get()) }
    single<UserLocalDataSource> { UserLocalDataSourceImpl(get()) }

    // Memory cache
    single { MemoryCache() }

    // Repositories
    single<UserRepository> { UserRepositoryImpl(get(), get(), get()) }

    // Use cases
    factory { GetUserUseCase(get()) }
    factory { ObserveUserUseCase(get()) }
    factory { RefreshUserDataUseCase(get()) }
}
```

## Platform-Specific Database

> A single `DatabaseFactory` that instantiates `AppDatabase` directly with a file path (as if
> it were a plain constructor call) does not compile for either library: Room's `@Database`
> class is `abstract` and must be built via `Room.databaseBuilder(...)`, and SQLDelight's
> generated database class takes a `SqlDriver`, not a path string. This also conflates the two
> libraries' setup into one factory, which isn't a real option — pick one:
>
> - **Room (KMP)** — see `android-data-layer`'s `@ConstructedBy(AppDatabaseConstructor::class)` +
>   `expect object AppDatabaseConstructor : RoomDatabaseConstructor<AppDatabase>` recipe, with
>   `BundledSQLiteDriver` and a per-platform `Room.databaseBuilder(...)` call.
> - **SQLDelight** — see `sqldelight-patterns`' `expect class DriverFactory` that produces a
>   platform `SqlDriver` (`AndroidSqliteDriver` / `NativeSqliteDriver`), passed into the
>   generated `AppDatabase(driver = ...)` constructor.

## Repository Testing

MockK is JVM-only and breaks Native/JS targets — `commonTest` must use `kotlin.test` only.
Rather than moving this suite to `jvmTest`/`androidUnitTest` (which would leave Native/JS
untested), use hand-written fakes implementing the real data-source interfaces directly in
`commonTest`:

```kotlin
// commonTest/kotlin/data/repository/UserRepositoryTest.kt
class FakeUserRemoteDataSource : UserRemoteDataSource {
    var getUserResult: User? = null
    var getUserCalled = false

    override suspend fun getUser(id: String): User =
        getUserResult?.also { getUserCalled = true } ?: error("no user configured")
    override suspend fun getUsers(page: Int): PaginatedResponse<User> = error("not used")
    override suspend fun createUser(user: User): User = error("not used")
    override suspend fun updateUser(id: String, user: User): User = error("not used")
    override suspend fun deleteUser(id: String) = error("not used")
}

class FakeUserLocalDataSource : UserLocalDataSource {
    private val users = mutableMapOf<String, User>()
    var savedUser: User? = null

    override suspend fun getUser(id: String): User? = users[id]
    override suspend fun getAllUsers(): List<User> = users.values.toList()
    override suspend fun saveUser(user: User) { users[user.id] = user; savedUser = user }
    override suspend fun saveUsers(users: List<User>) { users.forEach { saveUser(it) } }
    override suspend fun deleteUser(id: String) { users.remove(id) }
    override suspend fun clearAll() { users.clear() }
    override fun observeUser(id: String): Flow<User> = flowOf(users[id] ?: error("no user"))
    override fun observeAllUsers(): Flow<List<User>> = flowOf(users.values.toList())
}

class UserRepositoryTest {
    private lateinit var repository: UserRepository
    private lateinit var fakeRemote: FakeUserRemoteDataSource
    private lateinit var fakeLocal: FakeUserLocalDataSource

    @BeforeTest
    fun setup() {
        fakeRemote = FakeUserRemoteDataSource()
        fakeLocal = FakeUserLocalDataSource()
        repository = UserRepositoryImpl(
            remoteDataSource = fakeRemote,
            localDataSource = fakeLocal,
            memoryCache = MemoryCache()
        )
    }

    @Test
    fun `returns cached user when available`() = runTest {
        val cachedUser = User(id = "123", name = "John")
        fakeLocal.saveUser(cachedUser)

        val result = repository.getUser("123")

        assertTrue(result.isSuccess)
        assertEquals(cachedUser, result.getOrNull())
        assertFalse(fakeRemote.getUserCalled)
    }

    @Test
    fun `fetches from network when cache empty`() = runTest {
        val networkUser = User(id = "123", name = "John")
        fakeRemote.getUserResult = networkUser

        val result = repository.getUser("123")

        assertTrue(result.isSuccess)
        assertEquals(networkUser, result.getOrNull())
        assertTrue(fakeRemote.getUserCalled)
        assertEquals(networkUser, fakeLocal.savedUser)
    }
}
```

## Best Practices

### ✅ DO

```kotlin
// ✅ Define interfaces in commonMain
interface UserRepository { ... }

// ✅ Return Result for error handling
suspend fun getUser(id: String): Result<User>

// ✅ Expose Flow for state
fun observeUser(id: String): Flow<User>

// ✅ Use base repository for common patterns
class UserRepositoryImpl : BaseRepository() { ... }

// ✅ Keep repositories platform-agnostic
// No Android/iOS specific code in repository implementations
```

### ❌ DON'T

```kotlin
// ❌ Don't expose platform types
suspend fun getUser(): SQLiteDatabase  // ❌
suspend fun getUser(): User  // ✅

// ❌ Don't put business logic in repositories
if (user.age < 18) throw Exception()  // ❌ belongs in use case

// ❌ Don't make repositories depend on each other
// Use use cases to coordinate

// ❌ Don't use global state
object UserRepository { ... }  // ❌ use DI
```

---

**Remember**: Repositories are your data gatekeepers. Keep them platform-agnostic, testable, and focused on data coordination.

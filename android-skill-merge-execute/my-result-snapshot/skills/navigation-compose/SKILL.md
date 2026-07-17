---
name: navigation-compose
description: Jetpack Compose Navigation patterns - type-safe routes, NavHost setup, argument passing, deep links, nested navigation graphs, and bottom navigation.
---

# Jetpack Compose Navigation Patterns

> **Navigation 3 (`androidx.navigation3`) is the default for greenfield Compose navigation work.** It is a separate, Compose-first library (you own the back stack as observable state; a `NavDisplay` renders it via an `entryProvider` — no `NavController`, no graph builder) and is the direction Jetpack navigation is heading. Use the `navigation-3` skill for that.
>
> The patterns below (`androidx.navigation:navigation-compose`, `NavHost`/`NavController`) are **for maintaining existing projects that are already built on classic Navigation Compose** — not guidance for starting new navigation from scratch. Reach for this file when you're extending or fixing an app already on this framework, or in the rare case Nav3 genuinely can't fit.

## Dependencies

```kotlin
dependencies {
    implementation("androidx.navigation:navigation-compose:2.8.5")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.7.3")
}
```

## Type-Safe Routes with Sealed Interface

```kotlin
@Serializable
sealed interface Route {
    @Serializable
    data object Home : Route

    @Serializable
    data object Settings : Route

    @Serializable
    data class UserProfile(val userId: String) : Route

    @Serializable
    data class PostDetail(val postId: Long, val showComments: Boolean = false) : Route
}

// For nested graphs
@Serializable
sealed interface AuthGraph {
    @Serializable
    data object Login : AuthGraph

    @Serializable
    data object Register : AuthGraph

    @Serializable
    data object ForgotPassword : AuthGraph
}
```

## NavHost Configuration

```kotlin
@Composable
fun AppNavHost(
    navController: NavHostController = rememberNavController(),
    modifier: Modifier = Modifier
) {
    NavHost(
        navController = navController,
        startDestination = Route.Home,
        modifier = modifier
    ) {
        composable<Route.Home> {
            HomeScreen(
                onNavigateToProfile = { userId ->
                    navController.navigate(Route.UserProfile(userId))
                },
                onNavigateToSettings = {
                    navController.navigate(Route.Settings)
                }
            )
        }

        composable<Route.Settings> {
            SettingsScreen(onBack = { navController.popBackStack() })
        }

        composable<Route.UserProfile> { backStackEntry ->
            val route = backStackEntry.toRoute<Route.UserProfile>()
            UserProfileScreen(userId = route.userId)
        }

        composable<Route.PostDetail> { backStackEntry ->
            val route = backStackEntry.toRoute<Route.PostDetail>()
            PostDetailScreen(
                postId = route.postId,
                showComments = route.showComments
            )
        }
    }
}
```

## Argument Passing with Legacy navArgument

For non-serializable routes, use the classic approach:

```kotlin
composable(
    route = "post/{postId}?showComments={showComments}",
    arguments = listOf(
        navArgument("postId") { type = NavType.LongType },
        navArgument("showComments") {
            type = NavType.BoolType
            defaultValue = false
        }
    )
) { backStackEntry ->
    val postId = backStackEntry.arguments?.getLong("postId") ?: return@composable
    val showComments = backStackEntry.arguments?.getBoolean("showComments") ?: false
    PostDetailScreen(postId = postId, showComments = showComments)
}

// Navigate
navController.navigate("post/$postId?showComments=true")
```

## Navigation with Results (SavedStateHandle)

```kotlin
// Screen A: Navigate and listen for result
@Composable
fun ScreenA(navController: NavHostController) {
    val result = navController.currentBackStackEntry
        ?.savedStateHandle
        ?.getStateFlow<String?>("selected_item", null)
        ?.collectAsState()

    LaunchedEffect(result?.value) {
        result?.value?.let { item ->
            // Handle the result
        }
    }

    Button(onClick = { navController.navigate(Route.ItemPicker) }) {
        Text("Pick Item")
    }
}

// Screen B: Set result and go back
@Composable
fun ItemPickerScreen(navController: NavHostController) {
    Button(onClick = {
        navController.previousBackStackEntry
            ?.savedStateHandle
            ?.set("selected_item", "chosen_value")
        navController.popBackStack()
    }) {
        Text("Select This")
    }
}
```

## Deep Link Registration

```kotlin
composable<Route.PostDetail>(
    deepLinks = listOf(
        navDeepLink {
            uriPattern = "https://example.com/posts/{postId}"
        },
        navDeepLink {
            uriPattern = "myapp://posts/{postId}"
        }
    )
) { backStackEntry ->
    val route = backStackEntry.toRoute<Route.PostDetail>()
    PostDetailScreen(postId = route.postId)
}
```

AndroidManifest.xml intent filter:

```xml
<activity android:name=".MainActivity">
    <intent-filter>
        <action android:name="android.intent.action.VIEW" />
        <category android:name="android.intent.category.DEFAULT" />
        <category android:name="android.intent.category.BROWSABLE" />
        <data android:scheme="https" android:host="example.com" />
        <data android:scheme="myapp" />
    </intent-filter>
</activity>
```

## Nested Navigation Graphs

```kotlin
fun NavGraphBuilder.authNavGraph(navController: NavHostController) {
    navigation<AuthGraph.Login>(startDestination = AuthGraph.Login) {
        composable<AuthGraph.Login> {
            LoginScreen(
                onLoginSuccess = {
                    navController.navigate(Route.Home) {
                        popUpTo(AuthGraph.Login) { inclusive = true }
                    }
                },
                onNavigateToRegister = {
                    navController.navigate(AuthGraph.Register)
                }
            )
        }
        composable<AuthGraph.Register> {
            RegisterScreen(onBack = { navController.popBackStack() })
        }
        composable<AuthGraph.ForgotPassword> {
            ForgotPasswordScreen(onBack = { navController.popBackStack() })
        }
    }
}

// In the main NavHost
NavHost(navController = navController, startDestination = AuthGraph.Login) {
    authNavGraph(navController)
    composable<Route.Home> { HomeScreen() }
}
```

## Bottom Navigation

```kotlin
@Serializable
sealed interface BottomTab {
    @Serializable data object Feed : BottomTab
    @Serializable data object Search : BottomTab
    @Serializable data object Profile : BottomTab
}

data class BottomNavItem(
    val route: BottomTab,
    val label: String,
    val icon: ImageVector
)

val bottomNavItems = listOf(
    BottomNavItem(BottomTab.Feed, "Feed", Icons.Default.Home),
    BottomNavItem(BottomTab.Search, "Search", Icons.Default.Search),
    BottomNavItem(BottomTab.Profile, "Profile", Icons.Default.Person)
)

@Composable
fun MainScreen() {
    val navController = rememberNavController()
    val navBackStackEntry by navController.currentBackStackEntryAsState()

    Scaffold(
        bottomBar = {
            NavigationBar {
                bottomNavItems.forEach { item ->
                    val isSelected = navBackStackEntry?.destination?.hasRoute(
                        item.route::class
                    ) == true

                    NavigationBarItem(
                        selected = isSelected,
                        onClick = {
                            navController.navigate(item.route) {
                                popUpTo(navController.graph.findStartDestination().id) {
                                    saveState = true
                                }
                                launchSingleTop = true
                                restoreState = true
                            }
                        },
                        icon = { Icon(item.icon, contentDescription = item.label) },
                        label = { Text(item.label) }
                    )
                }
            }
        }
    ) { padding ->
        NavHost(
            navController = navController,
            startDestination = BottomTab.Feed,
            modifier = Modifier.padding(padding)
        ) {
            composable<BottomTab.Feed> { FeedScreen() }
            composable<BottomTab.Search> { SearchScreen() }
            composable<BottomTab.Profile> { ProfileScreen() }
        }
    }
}
```

## Animated Transitions

```kotlin
composable<Route.PostDetail>(
    enterTransition = {
        slideIntoContainer(
            towards = AnimatedContentTransitionScope.SlideDirection.Left,
            animationSpec = tween(300)
        )
    },
    exitTransition = {
        slideOutOfContainer(
            towards = AnimatedContentTransitionScope.SlideDirection.Left,
            animationSpec = tween(300)
        )
    },
    popEnterTransition = {
        slideIntoContainer(
            towards = AnimatedContentTransitionScope.SlideDirection.Right,
            animationSpec = tween(300)
        )
    },
    popExitTransition = {
        slideOutOfContainer(
            towards = AnimatedContentTransitionScope.SlideDirection.Right,
            animationSpec = tween(300)
        )
    }
) { backStackEntry ->
    val route = backStackEntry.toRoute<Route.PostDetail>()
    PostDetailScreen(postId = route.postId)
}
```

## Navigation Testing

```kotlin
@Test
fun navigateToProfile_displaysUserProfile() {
    val navController = TestNavHostController(ApplicationProvider.getApplicationContext())

    composeTestRule.setContent {
        navController.navigatorProvider.addNavigator(ComposeNavigator())
        AppNavHost(navController = navController)
    }

    composeTestRule.onNodeWithText("View Profile").performClick()

    val currentRoute = navController.currentBackStackEntry?.destination?.route
    assertTrue(currentRoute?.contains("UserProfile") == true)
}
```

## Compose-Shape Guardrails (apply with any Nav version)

These constrain *how composables interact with navigation*, independent of whether you're on classic Navigation Compose or Navigation 3:

- **Destination keys/data are top-level `@Serializable` fields, not captured callbacks.** A route like `Route.UserProfile(userId: String)` should carry plain data — capturing a lambda in a route class defeats type-safe routing and breaks `SavedStateHandle` restoration.
- **No `@Composable` lambdas in destination data.** The route describes *where you are*, not what's drawn; embedding a `@Composable` field couples navigation identity to composition identity and breaks back-stack restoration on process death.
- **ViewModels emit navigation events via a `Flow`/`Channel`** (e.g. `Channel<NavEvent>(BUFFERED).receiveAsFlow()`), collected in a `LaunchedEffect` that calls `navController.navigate(...)` — don't inject `NavController` into a ViewModel.
- **Don't navigate during composition** — trigger `navController.navigate(...)` from an event callback or a `LaunchedEffect`, never directly in the composable body.
- **Don't mix string routes and type-safe `@Serializable` routes** in the same graph; pick one scheme per `NavHost`.

## Best Practices

- Use type-safe routes with `@Serializable` data classes/objects over raw string routes.
- Keep navigation logic out of composables; pass lambda callbacks (`onNavigateTo`) instead.
- Use `popUpTo` with `inclusive = true` when navigating after login to clear the auth stack.
- Use `launchSingleTop = true` for bottom tabs to prevent duplicate destinations.
- Save and restore tab state with `saveState = true` and `restoreState = true`.
- Scope ViewModels to navigation entries with `koinViewModel()`.
- Test navigation by asserting on `navController.currentBackStackEntry`.

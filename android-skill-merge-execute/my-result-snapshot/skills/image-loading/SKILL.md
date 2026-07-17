---
name: image-loading
description: Image loading patterns for mobile - Coil for Android/Compose, async image loading for iOS, caching strategies, transformations, placeholders, and error handling.
---

# Image Loading Patterns for Mobile

## Dependencies (Android - Coil)

```kotlin
dependencies {
    implementation("io.coil-kt.coil3:coil-compose:3.0.4")
    implementation("io.coil-kt.coil3:coil-network-okhttp:3.0.4")
}
```

## Android / Compose with Coil

### AsyncImage Composable

```kotlin
AsyncImage(
    model = article.imageUrl,
    contentDescription = "Article cover image",
    contentScale = ContentScale.Crop,
    placeholder = painterResource(R.drawable.placeholder),
    error = painterResource(R.drawable.error_image),
    modifier = Modifier
        .fillMaxWidth()
        .height(200.dp)
        .clip(RoundedCornerShape(12.dp))
)
```

### SubcomposeAsyncImage for Custom States

```kotlin
SubcomposeAsyncImage(
    model = user.avatarUrl,
    contentDescription = "User avatar",
    modifier = Modifier
        .size(64.dp)
        .clip(CircleShape)
) {
    when (painter.state) {
        is AsyncImagePainter.State.Loading -> {
            ShimmerBox(modifier = Modifier.fillMaxSize())
        }
        is AsyncImagePainter.State.Error -> {
            Icon(
                imageVector = Icons.Default.Person,
                contentDescription = null,
                modifier = Modifier
                    .fillMaxSize()
                    .background(MaterialTheme.colorScheme.surfaceVariant)
                    .padding(16.dp)
            )
        }
        else -> {
            SubcomposeAsyncImageContent(contentScale = ContentScale.Crop)
        }
    }
}
```

### ImageRequest Builder

```kotlin
AsyncImage(
    model = ImageRequest.Builder(LocalPlatformContext.current)
        .data(imageUrl)
        .crossfade(300)
        .size(Size.ORIGINAL)
        .memoryCachePolicy(CachePolicy.ENABLED)
        .diskCachePolicy(CachePolicy.ENABLED)
        .build(),
    contentDescription = "Photo",
    contentScale = ContentScale.Fit,
    modifier = Modifier.fillMaxWidth()
)
```

### Transformations

> Verify against current Coil 3 docs before use — the Transformation API surface may have shifted toward Modifier-based composition for simple shapes.

```kotlin
AsyncImage(
    model = ImageRequest.Builder(LocalPlatformContext.current)
        .data(user.avatarUrl)
        .crossfade(true)
        .transformations(
            CircleCropTransformation(),
            // or RoundedCornersTransformation(16f)
            // or BlurTransformation(LocalPlatformContext.current, radius = 25f)
        )
        .build(),
    contentDescription = "Avatar",
    modifier = Modifier.size(48.dp)
)
```

### Custom ImageLoader Configuration

```kotlin
// In Application class or Koin module
val imageLoader = ImageLoader.Builder(context)
    .memoryCachePolicy(CachePolicy.ENABLED)
    .memoryCache {
        MemoryCache.Builder()
            .maxSizePercent(context, 0.25) // 25% of app memory
            .build()
    }
    .diskCachePolicy(CachePolicy.ENABLED)
    .diskCache {
        DiskCache.Builder()
            .directory(context.cacheDir.resolve("image_cache"))
            .maxSizeBytes(100L * 1024 * 1024) // 100 MB
            .build()
    }
    .respectCacheHeaders(true)
    .build()
```

### Coil + Koin Integration

```kotlin
val imageModule = module {
    single {
        ImageLoader.Builder(androidContext())
            .memoryCache {
                MemoryCache.Builder()
                    .maxSizePercent(androidContext(), 0.25)
                    .build()
            }
            .diskCache {
                DiskCache.Builder()
                    .directory(androidContext().cacheDir.resolve("image_cache"))
                    .maxSizeBytes(100L * 1024 * 1024)
                    .build()
            }
            .crossfade(true)
            .build()
    }
}

// In Application.onCreate or Compose root
setSingletonImageLoaderFactory { context ->
    get<ImageLoader>() // from Koin
}
```

### Preloading Images

```kotlin
// Preload images for better UX (e.g., in list adapter bind)
// Android-only as written (context.imageLoader is an Android extension); a KMP
// equivalent would take PlatformContext instead of Context.
fun preloadImage(context: Context, url: String) {
    val request = ImageRequest.Builder(context)
        .data(url)
        .size(200, 200)
        .memoryCachePolicy(CachePolicy.ENABLED)
        .build()
    context.imageLoader.enqueue(request)
}
```

## Cross-Platform Patterns

### Shimmer / Placeholder Effect (Compose)

```kotlin
@Composable
fun ShimmerBox(modifier: Modifier = Modifier) {
    val transition = rememberInfiniteTransition(label = "shimmer")
    val alpha by transition.animateFloat(
        initialValue = 0.3f,
        targetValue = 0.9f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 1000),
            repeatMode = RepeatMode.Reverse
        ),
        label = "shimmer_alpha"
    )

    Box(
        modifier = modifier
            .background(
                color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = alpha),
                shape = RoundedCornerShape(8.dp)
            )
    )
}

// Usage
ShimmerBox(
    modifier = Modifier
        .fillMaxWidth()
        .height(200.dp)
        .clip(RoundedCornerShape(12.dp))
)
```

### Error State Component

```kotlin
@Composable
fun ImageErrorState(
    onRetry: (() -> Unit)? = null,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .background(MaterialTheme.colorScheme.surfaceVariant),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Icon(
                imageVector = Icons.Default.BrokenImage,
                contentDescription = "Failed to load image",
                tint = MaterialTheme.colorScheme.onSurfaceVariant
            )
            if (onRetry != null) {
                TextButton(onClick = onRetry) {
                    Text("Retry")
                }
            }
        }
    }
}
```

### Memory Management - Downsampling

```kotlin
// Coil automatically downsamples, but for manual control:
AsyncImage(
    model = ImageRequest.Builder(LocalPlatformContext.current)
        .data(highResUrl)
        .size(400, 300) // downsample to target size
        .precision(Precision.INEXACT) // allow slight size differences
        .build(),
    contentDescription = "Thumbnail",
    modifier = Modifier.size(200.dp, 150.dp)
)
```

### Image Transformation Patterns

```kotlin
// Circle crop avatar
@Composable
fun Avatar(url: String?, size: Dp = 48.dp) {
    AsyncImage(
        model = ImageRequest.Builder(LocalPlatformContext.current)
            .data(url)
            .crossfade(true)
            .build(),
        contentDescription = "User avatar",
        placeholder = painterResource(R.drawable.avatar_placeholder),
        error = painterResource(R.drawable.avatar_default),
        modifier = Modifier
            .size(size)
            .clip(CircleShape)
            .border(2.dp, MaterialTheme.colorScheme.outline, CircleShape)
    )
}

// Rounded corners card image
@Composable
fun CardImage(url: String?, modifier: Modifier = Modifier) {
    AsyncImage(
        model = url,
        contentDescription = null,
        contentScale = ContentScale.Crop,
        placeholder = painterResource(R.drawable.placeholder),
        modifier = modifier.clip(RoundedCornerShape(12.dp))
    )
}
```

## Best Practices

- Always provide placeholder and error drawables for every image load.
- Use `crossfade(true)` for smoother transitions from placeholder to loaded image.
- Configure disk cache size based on app needs (50-200 MB typical).
- Set memory cache to 20-25% of available app memory.
- Use `ContentScale.Crop` for fixed-size containers, `ContentScale.Fit` for flexible ones.
- Preload images for items about to scroll into view in lists.
- Clear caches on low-memory warnings (`onTrimMemory` / `didReceiveMemoryWarning`).
- For lists, set explicit sizes on image composables to prevent layout jumps during load.
- Use shimmer effects instead of spinner placeholders for a more polished loading experience.

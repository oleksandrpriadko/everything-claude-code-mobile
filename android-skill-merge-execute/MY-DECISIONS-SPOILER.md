# ⚠️ Spoiler — read only after your own independent attempt

This is a record of the specific judgment calls made in the reference attempt (`my-result-snapshot/`). If you're comparing a fresh attempt against this one, decide your own answers to these first — then compare.

## Correctness findings (not judgment calls — these were verified bugs, expect any good attempt to catch them too)
- ahmed3elshaer's `coroutines-patterns`/`shared-coroutines`/`expect-actual`/`koin-patterns`/`kmp-di`/`mvi-architecture` all lost on verified correctness bugs (self-contradictions, code that doesn't compile, a state-loss bug in DI scope choice) — deleted, not a taste call.
- `kmp-repositories` (kept) had Room+SQLDelight conflated in one hand-rolled class that can't compile, plus MockK inside `commonTest` (breaks non-JVM targets) — fixed in place.
- `datastore` skill's Typed-DataStore example used JVM-only `java.io` types despite claiming KMP support — added a genuinely KMP-safe Okio-based alternative alongside it.

Note: app-building/live verification was a separate follow-up step in the reference attempt, out of scope for this comparison — it's not reflected in `my-result-snapshot/` beyond the fixes above.

## Genuine judgment calls (no single correct answer — these are what to compare)
- **DI default**: Koin only, Hilt dropped entirely (not even kept as an alternate skill).
- **Navigation default**: Navigation 3 for new work, classic Navigation Compose reframed as legacy-only.
- **Testing philosophy**: fakes over mocks for collaborator substitution.
- **Result/error-model naming**: a custom sealed error type must not be named `Result` (shadows `kotlin.Result`) — named `DomainOutcome` instead.
- **Compose optional-slot typing**: nullable `(@Composable () -> Unit)? = null` over an empty-lambda default.
- **Structural decision**: kept ahmed3elshaer's repo as the base/chassis (its 27 agents/35 commands/hooks/MCP servers), replacing nearly all of its *skill content* with the other two repos' skills. A fresh attempt might reasonably choose a different structure entirely (e.g. build a flat skill-only plugin with no agent/command layer) — that's a legitimate divergence, not necessarily a mistake either way.

## What was explicitly deferred, not decided
- ~22 of ahmed3elshaer's skills (iOS-native, accessibility, security, CI/CD, etc.) were never audited for correctness — kept only because nothing else covered that ground.
- The chassis itself (the 27 agents/35 commands) was never audited — only its skill *content* references were fixed (rewired after deletes).

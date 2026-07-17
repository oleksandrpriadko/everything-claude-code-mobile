export const meta = {
  name: 'android-skill-merge-execute',
  description: 'Execute the decided 3-repo Android skill merge into ahmed3elshaer base, on a dedicated branch',
  phases: [
    { title: 'Prepare', detail: 'map shared-file contention and skill cross-references before touching anything' },
    { title: 'Execute', detail: 'per-cluster copy/delete/merge/fix, sequenced where files are shared' },
    { title: 'Rewire', detail: 'fix agent/command references to deleted or renamed skills' },
    { title: 'Verify', detail: 'adversarially re-check every confirmed bug-fix actually landed' },
  ],
}

const AHMED = '/Users/oleksandr.priadko/Documents/StudioProjects/sub/everything-claude-code-mobile'
const CHRIS = '/Users/oleksandr.priadko/Documents/StudioProjects/sub/skills/skills'
const RCOS  = '/Users/oleksandr.priadko/Documents/StudioProjects/sub/android-skills/plugins/android-skills/skills'
const AH_SKILLS = `${AHMED}/skills`

phase('Prepare')
const prep = await agent(
  `Prepare context for a skill-merge execution in the git repo at ${AHMED} (currently on branch skill-merge-audit, already clean).

1. Read ${AHMED}/.claude-plugin/plugin.json and marketplace.json (if present) — does either enumerate skill names explicitly? If so, note the exact list format so it can be updated later when skills are added/removed/renamed.
2. Grep ${AHMED}/agents/ and ${AHMED}/commands/ and ${AHMED}/hooks/ (recursively, all .md and .json/.js) for any reference (by folder name or skill "name:" frontmatter value) to these skill names that are about to be DELETED: jetpack-compose, coroutines-patterns, shared-coroutines, expect-actual, koin-patterns, kmp-di, mvi-architecture, android-patterns, gradle-patterns, ktor-patterns, kmp-networking, mobile-testing, kmp-navigation. Report every file + line that references any of them, and what it should point to instead among the SURVIVING skill names: compose, compose-animations, compose-focus-navigation, compose-modifier-and-layout-style, compose-recomposition-performance, compose-side-effects, compose-slot-api-pattern, compose-stability-diagnostics, compose-state-authoring, compose-state-deferred-reads, compose-state-hoisting, compose-state-holder-ui-split, kotlin-coroutines, kotlin-flows, kotlin-coroutines-structured-concurrency, kotlin-flow-state-event-modeling, kmp-boundaries, kotlin-multiplatform-expect-actual, koin, android-dev, modularization, android-gradle-logic, gradle-build-performance, kmp-ktor, android-retrofit, android-testing, android-debugging, navigation-compose, deep-linking.
3. List the current top-level contents of ${AH_SKILLS}/ so we know the exact starting state.

Return a concise structured report: manifest format (or "none"), list of broken-reference sites found, current skill directory listing.`,
  { label: 'prepare', phase: 'Prepare', agentType: 'general-purpose' }
)

phase('Execute')

const CLUSTERS = [
{ key:'compose', plan: `
DELETE: ${AH_SKILLS}/jetpack-compose/ (entire folder, fully subsumed by chris's files, no salvage needed).
COPY IN from ${CHRIS}/: compose-animations, compose-focus-navigation, compose-modifier-and-layout-style, compose-recomposition-performance, compose-side-effects, compose-slot-api-pattern, compose-stability-diagnostics, compose-state-authoring, compose-state-deferred-reads, compose-state-hoisting, compose-state-holder-ui-split, compose-ui-testing-patterns — copy each whole folder into ${AH_SKILLS}/.
COPY IN from ${RCOS}/compose/ the whole folder into ${AH_SKILLS}/compose/, THEN inside its references/ subfolder DELETE these 6 files (verified duplicates of chris's deeper files, safe since chris's versions are being kept): modifiers.md, view-composition.md, state-management.md, side-effects.md, animation.md, focus-navigation.md. KEEP all other reference files as-is (lists-scrolling.md, navigation.md, accessibility.md, theming-material3.md, multiplatform.md, platform-specifics.md, production-crash-playbook.md, styles-experimental.md, design-to-compose.md, composition-locals.md, deprecated-patterns.md).
FIX bugs in the KEPT reference files (read them, find and fix precisely — these are CONFIRMED via adversarial verification, not speculative):
  - production-crash-playbook.md §5: \`val filteredItems by remember { derivedStateOf { allItems.filter { it.name.contains(filter) } } }\` has no remember keys and reads plain params instead of State inside derivedStateOf, so it never re-evaluates. Fix: key the remember on the actual inputs, e.g. \`val filteredItems by remember(allItems, filter) { derivedStateOf { allItems.filter { it.name.contains(filter) } } }\` (or restructure so derivedStateOf reads State objects, whichever fits the surrounding example).
  - performance.md: locate the GOOD example using \`remember\` that the audit flagged as still buggy (minor severity) — read the full file, find the incorrect remember usage, and correct it to actually skip recomposition as claimed.
  - animation-recipes.md: locate the shimmer example flagged as buggy (minor) — read the file, find the issue, fix it so the shimmer effect behaves as documented.
  - production-crash-playbook.md §7 (SafeShimmer) and §4 (dedup-index): two more minor confirmed bugs — read those sections carefully and fix whatever is actually broken (re-derive from the surrounding correct examples in the same file for the intended behavior).
PORT: rcosteira's modern-lifecycle-effect guidance (LifecycleStartEffect/LifecycleResumeEffect/LifecycleEventEffect, lifecycle-runtime-compose 2.8+) — this note existed in the now-deleted references/side-effects.md — add a short paragraph with this guidance into ${AH_SKILLS}/compose-side-effects/SKILL.md (the chris file, now copied in), noting these newer APIs as preferred over raw DisposableEffect+LifecycleEventObserver for simple lifecycle-event cases.
Do NOT touch android-dev/SKILL.md or shared-models — those are handled in other clusters/phases.
Report exactly what you deleted, copied, and fixed, file by file.` },

{ key:'coroutines-flow', plan: `
First READ ${AHMED}/skills/shared-coroutines/SKILL.md and salvage its iOS PlatformDispatcher implementation (NSQueueDispatcher/DispatchQueueDispatcher wrapping dispatch_queue_t) — you will add a short subsection with this snippet into the KMP section of ${RCOS}/kotlin-coroutines/SKILL.md's content once copied (see below). Ignore ahmed's ApplicationScope/ViewScope content — not being salvaged.
DELETE: ${AH_SKILLS}/coroutines-patterns/, ${AH_SKILLS}/shared-coroutines/ (after the salvage read above).
COPY IN from ${CHRIS}/: kotlin-coroutines-structured-concurrency, kotlin-flow-state-event-modeling — whole folders into ${AH_SKILLS}/.
COPY IN from ${RCOS}/: kotlin-coroutines, kotlin-flows — whole folders into ${AH_SKILLS}/. Then edit the newly-copied ${AH_SKILLS}/kotlin-coroutines/SKILL.md: find its KMP dispatcher section (currently just a one-line pointer to expect/actual Dispatchers.Main.immediate) and add the salvaged iOS PlatformDispatcher snippet as a concrete example beneath it.
Report exactly what you deleted, copied, and what you added to kotlin-coroutines/SKILL.md.` },

{ key:'expect-actual', plan: `
First READ ${AH_SKILLS}/expect-actual/SKILL.md and identify its source-set organizational diagram/scaffolding (NOT its expect-class code examples, which are wrong/superseded — do not salvage those). You are salvaging ONLY organizational structure notes, if any exist that add value beyond what kmp-boundaries already covers.
DELETE: ${AH_SKILLS}/expect-actual/.
COPY IN from ${CHRIS}/: kotlin-multiplatform-expect-actual — whole folder into ${AH_SKILLS}/.
COPY IN from ${RCOS}/: kmp-boundaries — whole folder into ${AH_SKILLS}/. If you found genuinely unique organizational scaffolding worth keeping from ahmed's file in the first step, add it as a short note into the copied kmp-boundaries/SKILL.md; if nothing unique survives scrutiny, skip this — do not force a salvage that isn't there.
Report what you deleted, copied, and whether anything was salvaged (and why/why not).` },

{ key:'di-koin', plan: `
Hilt is being dropped ENTIRELY per explicit decision — Koin is the sole DI skill, no Hilt fallback anywhere.
First READ ${AH_SKILLS}/kmp-di/SKILL.md and salvage: (a) the non-Koin "Manual DI" alternative (plain-Kotlin AppContainer / ServiceLocator pattern, for contexts that don't want Koin at all), (b) the Voyager-style getScreenModel() snippet for non-Android KMP UI. Ignore the rest (redundant with koin-patterns/koin).
DELETE: ${AH_SKILLS}/koin-patterns/, ${AH_SKILLS}/kmp-di/ (after the salvage read above).
COPY IN from ${RCOS}/: koin — whole folder into ${AH_SKILLS}/. Then edit the newly-copied ${AH_SKILLS}/koin/SKILL.md to add a short "Manual DI alternative" subsection with the two salvaged snippets from step 1.
Do NOT touch android-dev/SKILL.md — the Koin-only default-line fix there happens in a later sequenced phase, after this and the architecture cluster both finish.
Report what you deleted, copied, and salvaged.` },

{ key:'architecture', plan: `
First READ ${AH_SKILLS}/mvi-architecture/SKILL.md and salvage its complete, working Turbine-based ViewModel test snippet — you will adapt it (not copy verbatim) to test the Actions-interface dispatch style (discrete method calls like onItemClick/onRefresh) instead of sealed-Intent dispatch, since that's the style the surviving android-dev skill uses.
Also READ ${AH_SKILLS}/android-patterns/SKILL.md and salvage any genuinely unique, correct Kotlin-language-idiom reference content not covered elsewhere (skip anything redundant with kept skills).
DELETE: ${AH_SKILLS}/mvi-architecture/, ${AH_SKILLS}/android-patterns/ (after the salvage reads above).
COPY IN from ${RCOS}/: android-dev, modularization — whole folders into ${AH_SKILLS}/.
Edit the newly-copied ${AH_SKILLS}/android-dev/SKILL.md: add the adapted Turbine test snippet (testing Actions-interface calls) as a new "Testing" subsection, and add the salvaged Kotlin-idiom notes from android-patterns if any survived scrutiny.
Do NOT touch the DI default line in android-dev/SKILL.md yet — that specific edit happens in a later sequenced phase after this cluster and di-koin both finish, to avoid two agents racing on the same file.
Report what you deleted, copied, and added to android-dev/SKILL.md.` },

{ key:'gradle', plan: `
First READ ${AH_SKILLS}/gradle-patterns/SKILL.md and salvage: the concrete libs.versions.toml worked example with [bundles] (it should already be Koin+Ktor based, matching our house DI/network defaults — keep as-is if so, note in your report if it isn't), the multi-module include(...) structure example (:app, :core:common, :core:ui etc), the build/diagnostic command cheat-sheet (./gradlew build --profile, --scan, etc), and the extra gradle.properties tuning keys (android.nonFinalResIds=true, kotlin.incremental.*, etc).
DELETE: ${AH_SKILLS}/gradle-patterns/ (after the salvage read above).
COPY IN from ${RCOS}/: android-gradle-logic, gradle-build-performance — whole folders into ${AH_SKILLS}/.
Edit the newly-copied ${AH_SKILLS}/android-gradle-logic/SKILL.md: add the salvaged libs.versions.toml example and multi-module structure example.
Edit the newly-copied ${AH_SKILLS}/gradle-build-performance/SKILL.md: add the salvaged command cheat-sheet and gradle.properties tuning keys.
Report what you deleted, copied, and where each salvaged piece landed.` },

{ key:'image-loading', plan: `
This is a TRIM, not a delete — the user wants multiplatform Coil, and ahmed's Android code examples use LocalContext.current directly which does NOT compile in commonMain (a real bug, not style), but the file has genuinely unique content worth keeping.
READ ${AH_SKILLS}/image-loading/SKILL.md in full first.
EDIT it in place:
  1. DELETE the entire "## iOS / SwiftUI" section (native AsyncImage, ImageCache class, CachedAsyncImage view) and the iOS downsampling Swift code block under "Memory Management - Downsampling" — if going multiplatform Coil, native SwiftUI image loading is a competing, redundant pattern, not a complement.
  2. In the Avatar example under "Image Transformation Patterns", the code applies BOTH .transformations(CircleCropTransformation()) AND Modifier.clip(CircleShape) — this is redundant double-work (the Modifier.clip alone achieves the visual circle crop; the bitmap-level transformation costs extra CPU for no visual gain). Remove the CircleCropTransformation() call, keep only the Modifier.clip(CircleShape).
  3. Add a one-line flag/comment at the top of the "### Transformations" section: "Verify against current Coil 3 docs before use — the Transformation API surface may have shifted toward Modifier-based composition for simple shapes." Do not otherwise rewrite that section's content — just flag it, since its current correctness wasn't independently verified.
  4. Replace all remaining Android-only \`LocalContext.current\` occurrences in code examples with \`LocalPlatformContext.current\` (the multiplatform-safe equivalent, matching the coil-compose skill being copied in below) EXCEPT where the surrounding code is genuinely Android-only API (e.g. \`context.imageLoader.enqueue\` in the preload example, \`Application class\` references) — for those, leave as Android Context but add a one-line note that a KMP equivalent would need the platform's PlatformContext.
  5. Keep as-is: cache sizing best practices (25% memory, 50-200MB disk), the Coil+Koin ImageLoader wiring example, the preload-for-list-items pattern, the shimmer/error-state composables, the Best Practices checklist — trim only bullets in that checklist that are pure duplicates of guardrails already in coil-compose (the SubcomposeAsyncImage-in-lists warning and the explicit-size-to-avoid-OOM warning — check coil-compose/SKILL.md content first to confirm exact overlap before trimming).
COPY IN from ${RCOS}/: coil-compose — whole folder into ${AH_SKILLS}/, unchanged, as the KMP-correctness base.
Report exactly what you removed, what you kept, and what you flagged for manual verification.` },

{ key:'networking', plan: `
First READ ${AH_SKILLS}/ktor-patterns/SKILL.md and ${AH_SKILLS}/kmp-networking/SKILL.md in full and salvage: certificate pinning via CertificatePinner with documented backup pin, the HttpSend request-interceptor pattern for per-request headers, per-platform engine factory recipes (OkHttp with 10MB disk cache; iOS Darwin engine), a NetworkException taxonomy + Throwable.toNetworkException() mapper, multipart file upload via submitFormWithBinaryData, a manual exponential-backoff retry helper, the offline cache-with-TTL/stale-on-failure fallback CONCEPT (not necessarily the exact code), and the Koin DI network-module wiring example.
DELETE: ${AH_SKILLS}/ktor-patterns/, ${AH_SKILLS}/kmp-networking/ (after the salvage reads above).
COPY IN from ${RCOS}/: kmp-ktor, android-retrofit — whole folders into ${AH_SKILLS}/.
Edit the newly-copied ${AH_SKILLS}/kmp-ktor/SKILL.md: merge in ALL the salvaged pieces from step 1 as clearly-labeled subsections (cert pinning, header interceptor, engine factories, exception taxonomy, multipart upload, retry helper, offline cache concept, Koin wiring). When merging the NetworkException taxonomy, name the base error type consistently with the plugin's data-layer error convention (a sealed type named something other than bare "Result" — e.g. DataError or NetworkError as a DataError subtype — NOT a type literally named Result, to avoid shadowing kotlin.Result; if you're unsure of the exact shared type name used elsewhere, use "DataError" as the placeholder and note in your report that this should be reconciled with whatever the data-layer cluster settles on).
Report exactly what you deleted, salvaged, and merged, and where each piece landed in kmp-ktor/SKILL.md.` },

{ key:'data-layer', plan: `
This cluster KEEPS everything but requires real bug-fixes across 6 files. No deletions in this cluster. Work through each file precisely:

1. COPY IN from ${RCOS}/: android-data-layer, datastore — whole folders into ${AH_SKILLS}/ (these did not exist there before).
2. Edit ${AH_SKILLS}/android-data-layer/SKILL.md: find the line with setQueryCoroutineContext(Dispatchers.IO) under a commonMain comment — fix the surrounding note to clarify Dispatchers.IO does NOT resolve in commonMain (JVM/Native-only) and this call belongs in an intermediate concurrent source set, not plain commonMain.
3. Edit ${AH_SKILLS}/room-patterns/SKILL.md (ahmed's, already there): (a) add \`room { schemaDirectory("$projectDir/schemas") }\` (or equivalent) to actually back the exportSchema=true flag it declares — currently that flag has no schemaDirectory backing it, so no schema is actually exported, just a build warning; (b) find the @Insert(onConflict = OnConflictStrategy.REPLACE) called an "upsert" — replace it with Room's real @Upsert annotation (REPLACE is delete+reinsert, not a true upsert — different semantics, especially with foreign keys / autogenerated ids).
4. Edit ${AH_SKILLS}/sqldelight-patterns/SKILL.md (ahmed's, already there): replace every commonMain use of Dispatchers.IO (there are 4 occurrences) with Dispatchers.Default or an injected dispatcher parameter — Dispatchers.IO doesn't resolve outside JVM/Native. Also find the JdbcSqliteDriver in-memory test example and move/relabel it as belonging in jvmTest, not commonTest (JdbcSqliteDriver is JVM-only).
5. Edit ${AH_SKILLS}/shared-models/SKILL.md (ahmed's, already there): (a) fix the kotlinx-datetime version pin — it's set to 1.6.0 which doesn't exist; the real latest stable line is 0.6.x, use 0.6.1 or note "use the current stable 0.6.x release"; (b) align the serialization/Kotlin plugin version (currently 1.9.20) with room-patterns' Kotlin/KSP toolchain version (2.0.21) so the merged plugin has one consistent Kotlin version across examples; (c) THE KEY FIX: find the sealed class/interface literally named \`Result\` defined in this file — RENAME it to \`DataError\` (or if it's specifically modeling success/failure with a payload, consider \`DomainOutcome\`) throughout this file and update every reference to it in this file's own examples. Do not touch kotlin.Result usages elsewhere — only this file's own custom type that shadows the stdlib name.
6. Edit ${AH_SKILLS}/offline-first/SKILL.md (ahmed's, already there) — this file has the CancellationException bug pattern in FIVE places, find and fix each: networkBoundResource, getCacheFirst, getNetworkFirst, processQueue, retryWithBackoff — in each, find the broad \`catch (e: Exception)\` or \`catch (e: Throwable)\` block and add \`if (e is CancellationException) throw e\` as the first line inside the catch (or restructure to catch specific exception types instead of the broad type — whichever fits the existing code style). Also in processQueue specifically: find where it deletes/mutates pending operations and make sure that mutation does NOT happen if the coroutine was cancelled mid-operation (check for the deletion happening before confirmed success, and guard it). Also find the call to \`connectivityMonitor.isCurrentlyConnected()\` — this method doesn't exist in the file's own ConnectivityMonitor definition; replace it with the actual defined surface, which should be something like \`connectivityMonitor.isConnected: Flow<Boolean>\` — use \`.first()\` to get a one-shot value from that Flow instead. Also find \`dao.transaction { }\` — this is not a real Room DAO API; replace with a proper \`@Transaction\`-annotated suspend function on the DAO, or wrap the calls in \`db.withTransaction { }\` from androidx.room.
7. Edit ${AH_SKILLS}/kmp-repositories/SKILL.md (ahmed's, already there): (a) DELETE the hand-rolled DatabaseFactory code block that conflates Room and SQLDelight and instantiates an abstract AppDatabase(path) directly — this cannot compile. (b) DELETE the UserLocalDataSourceImpl that also conflates the two libraries and calls userQueries() as if it were a function (it's a generated property, not a function, in real SQLDelight). (c) Replace both deleted parts with a short note pointing to android-data-layer's modern KMP-Room recipe (@ConstructedBy + RoomDatabaseConstructor expect object) and sqldelight-patterns' corrected usage (userQueries as a property) as the two supported options, rather than ahmed's broken hybrid. (d) Find the MockK-based tests located in commonTest — commonTest must be kotlin.test only (MockK is JVM-only and breaks Native/JS targets); move those tests to androidUnitTest or jvmTest, OR replace the MockK usage with a hand-written fake implementing the same repository interface directly in commonTest. (e) KEEP as-is (already correct per the audit): the BaseRepository execute/flowResult/cacheFirst/networkFirst/refresh functions and their CancellationException rethrow handling, the repository interface, the three-tier data-source model, and the use cases.

Report file-by-file exactly what you changed, quoting the before/after for each fix so it can be spot-checked.` },

{ key:'pagination', plan: `
No deletions. Edit ${AH_SKILLS}/pagination-patterns/SKILL.md (ahmed's, already there) in place:
1. Find the MAJOR double-render UI bug flagged in the audit — read the file's PagingSource/LazyColumn example carefully for a case where the same item or loading state renders twice (likely a loadState handling issue, e.g. rendering both an appended loading indicator AND a separate full-screen loader simultaneously, or a key/index mismatch causing a duplicate item entry) — identify and fix it. If you cannot find an unambiguous double-render bug on close reading, report exactly what you checked and why you believe it's not present, rather than inventing a fix.
2. Find the page-key duplication concern — add an explicit comment/caveat noting this behavior is dependent on the specific REST API's pagination semantics (offset vs cursor) and the developer must confirm against their actual API rather than assume the example's key strategy applies universally. Don't silently "fix" this one — it's genuinely API-dependent, just make the caveat explicit.
3. Merge in rcosteira's offline-first initial-loader gating rule from ${RCOS}/paging/SKILL.md (gate the full-screen initial loader on \`loadState.source.refresh\`, not the mediator/append states) as a new subsection.
4. Add a cross-reference line pointing to ${AH_SKILLS}/paging/SKILL.md (being copied in below) for expert-level/advanced material this file doesn't cover.
COPY IN from ${RCOS}/: paging — whole folder into ${AH_SKILLS}/, unchanged.
Report what you fixed, what you flagged as API-dependent rather than fixed, and what you merged in.` },

{ key:'testing', plan: `
First READ ${AH_SKILLS}/mobile-testing/SKILL.md and salvage any unique, non-buggy coverage it has that ${RCOS}/android-testing doesn't (check both before deciding what's unique).
DELETE: ${AH_SKILLS}/mobile-testing/ (after the salvage read above).
COPY IN from ${CHRIS}/: compose-ui-testing-patterns — whole folder into ${AH_SKILLS}/.
COPY IN from ${RCOS}/: android-testing, android-debugging — whole folders into ${AH_SKILLS}/.
Edit the newly-copied ${AH_SKILLS}/android-testing/SKILL.md: add whatever unique content survived the salvage from mobile-testing.
Edit the newly-copied ${AH_SKILLS}/compose-ui-testing-patterns/SKILL.md: find its flagship interaction-state test example using MutableInteractionSource — the audit confirmed this example is broken; read android-testing's corrected version of the same pattern (if present) and use it to fix compose-ui-testing-patterns' version; if android-testing doesn't have an equivalent, fix it directly by ensuring the MutableInteractionSource is properly injected/emitted rather than relying on simulated pointer events.
Edit ${AH_SKILLS}/mobile-verification/SKILL.md (ahmed's, already there, keeping): find its two confirmed-wrong Compose/Espresso flaky-test-fix snippets and replace them with android-testing's correct equivalents (read android-testing first to find the right replacement content).
Edit ${AH_SKILLS}/ios-testing/SKILL.md (ahmed's, already there, keeping — no Android/rcosteira equivalent exists): add a brief note that the plugin's house testing policy elsewhere favors fakes over mocks for collaborator substitution, and that this preference applies to Swift/XCTest work where practical too — but do NOT force a wholesale rewrite of Swift-specific protocol-mocking idioms, since mocking is more culturally idiomatic in the Swift/XCTest ecosystem than in Kotlin; just add the cross-reference note, flag the tension, don't erase existing correct Swift content.
Report exactly what you deleted, salvaged, copied, and fixed — including quoting the before/after of the MutableInteractionSource fix.` },

{ key:'navigation', plan: `
DELETE: ${AH_SKILLS}/kmp-navigation/ (per decision — no salvage needed, but note in your report that this removes the only KMP-navigation-specific coverage in the merged plugin, as a flag for the user, not a blocker).
KEEP as-is: ${AH_SKILLS}/navigation-compose/, ${AH_SKILLS}/deep-linking/ (both ahmed's, already there) — but edit navigation-compose/SKILL.md: find wherever it frames itself as THE default/recommended navigation approach and reframe it — Navigation 3 should now be stated as the default for new Compose work, with this skill's classic Navigation Compose content explicitly reframed as "for maintaining existing projects already on this framework," not greenfield guidance. Do not delete the classic content, just change the framing/default statement at the top of the file.
READ ${RCOS}/compose/references/navigation.md (this survived the compose cluster's dedup pass) and merge its framework-agnostic navigation guardrails (whatever ahmed's navigation-compose/deep-linking files lack — compare content first) into ${AH_SKILLS}/deep-linking/SKILL.md or navigation-compose/SKILL.md, whichever fits better contextually.
Report what you deleted, reframed, and merged — and restate the KMP-navigation coverage gap flag clearly in your summary.` },
]

const execResults = await pipeline(
  CLUSTERS,
  (c) => agent(
    `Execute this exact, already-decided plan for the "${c.key}" cluster in the git repo at ${AHMED} (branch skill-merge-audit). Use Read/Edit/Write/Bash (cp -r for folder copies, rm -rf for deletes) as needed. This is EXECUTION of decisions already made — do not second-guess the decisions, only execute them precisely and report exactly what you did with enough detail (before/after snippets for fixes) that someone could spot-check your work without re-deriving it.\n\n${c.plan}`,
    { label: `exec:${c.key}`, phase: 'Execute', agentType: 'general-purpose' }
  ).then(r => ({ cluster: c.key, report: r }))
)

phase('Execute')
const crossCutting = await agent(
  `In the git repo at ${AHMED} (branch skill-merge-audit), edit ${AHMED}/skills/android-dev/SKILL.md (it has already been modified by the architecture cluster's execution — read its CURRENT content first, don't assume the original):
1. In the house-defaults list, find the line "**DI:** Hilt + KSP (or android-skills:koin when the project uses Koin)" (or whatever it now reads after prior edits) and change it to make Koin the sole default with NO Hilt mention at all: "**DI:** Koin."
2. In the example code block further down, find \`viewModel: FooViewModel = hiltViewModel()\` and change it to \`viewModel: FooViewModel = koinViewModel()\`.
3. Scan the rest of the file for any other Hilt/hiltViewModel/@HiltViewModel mentions and remove/replace them with the Koin equivalent, since Hilt is being dropped entirely from this plugin (not kept as an alternative).
Report the exact before/after for each change.`,
  { label: 'cross-cutting-di-fix', phase: 'Execute', agentType: 'general-purpose' }
)

phase('Rewire')
const rewire = await agent(
  `In the git repo at ${AHMED}, the following skill folders were just deleted: jetpack-compose, coroutines-patterns, shared-coroutines, expect-actual, koin-patterns, kmp-di, mvi-architecture, android-patterns, gradle-patterns, ktor-patterns, kmp-networking, mobile-testing, kmp-navigation.

Using the reference map found in this earlier prepare-phase report as a starting point (re-verify it, don't just trust it blindly — the file contents may have shifted since):
${JSON.stringify(prep)}

Grep ${AHMED}/agents/, ${AHMED}/commands/, ${AHMED}/hooks/, and ${AHMED}/.claude-plugin/ (all .md/.json/.js files) again NOW for any remaining reference to the deleted skill names above. For each one found, edit it to point to the correct surviving skill name (see the Prepare phase's mapping for the correct target — compose/compose-*, kotlin-coroutines/kotlin-flows, kmp-boundaries, koin, android-dev, android-gradle-logic/gradle-build-performance, kmp-ktor, android-testing, navigation-compose/deep-linking, as appropriate to what the reference was about).

Also check ${AHMED}/.claude-plugin/plugin.json and marketplace.json — if either enumerates skill names explicitly, update the list to remove the 13 deleted names and add the newly-added ones: compose-animations, compose-focus-navigation, compose-modifier-and-layout-style, compose-recomposition-performance, compose-side-effects, compose-slot-api-pattern, compose-stability-diagnostics, compose-state-authoring, compose-state-deferred-reads, compose-state-hoisting, compose-state-holder-ui-split, compose-ui-testing-patterns, kotlin-coroutines-structured-concurrency, kotlin-flow-state-event-modeling, kotlin-coroutines, kotlin-flows, kotlin-multiplatform-expect-actual, kmp-boundaries, koin, android-dev, modularization, android-gradle-logic, gradle-build-performance, coil-compose, kmp-ktor, android-retrofit, android-data-layer, datastore, paging, android-testing, android-debugging.

Report every fix you made, file by file, and confirm with a final fresh grep that zero references to the 13 deleted names remain anywhere in the repo.`,
  { label: 'rewire', phase: 'Rewire', agentType: 'general-purpose' }
)

phase('Verify')
const VERIFY_SCHEMA = {
  type:'object', additionalProperties:false,
  required:['checks','overallPass','remainingIssues'],
  properties:{
    checks:{type:'array', items:{
      type:'object', additionalProperties:false,
      required:['check','pass','evidence'],
      properties:{ check:{type:'string'}, pass:{type:'boolean'}, evidence:{type:'string'} }
    }},
    overallPass:{type:'boolean'},
    remainingIssues:{type:'array', items:{type:'string'}}
  }
}
const verify = await agent(
  `Adversarially re-verify (do NOT trust prior self-reports — re-read the actual files yourself) that the following fixes actually landed correctly in the git repo at ${AHMED} (branch skill-merge-audit):

1. grep -r "hiltViewModel\\|@HiltViewModel\\|Hilt + KSP" ${AHMED}/skills/ — should return ZERO matches (Hilt fully removed).
2. Read ${AHMED}/skills/shared-models/SKILL.md — confirm there is no sealed type literally named "Result" anymore (should be renamed, e.g. DataError), and confirm kotlinx-datetime version is NOT 1.6.0.
3. Read ${AHMED}/skills/offline-first/SKILL.md — grep for "catch (e: Exception)" and "catch (e: Throwable)" and confirm each either rethrows CancellationException or was restructured to not need it; confirm "connectivityMonitor.isCurrentlyConnected()" no longer appears; confirm "dao.transaction {" no longer appears.
4. Read ${AHMED}/skills/kmp-repositories/SKILL.md — confirm "DatabaseFactory" hand-rolled conflation code is gone, confirm no "MockK" import/usage remains inside a commonTest-labeled section.
5. Read ${AHMED}/skills/room-patterns/SKILL.md — confirm a real "@Upsert" annotation is used instead of "@Insert(onConflict = OnConflictStrategy.REPLACE)" being called an upsert, and confirm "schemaDirectory" now appears alongside exportSchema.
6. Read ${AHMED}/skills/sqldelight-patterns/SKILL.md — grep for "Dispatchers.IO" — should return zero matches in commonMain-labeled code.
7. Confirm via \`ls ${AHMED}/skills/\` that these 13 folders no longer exist: jetpack-compose, coroutines-patterns, shared-coroutines, expect-actual, koin-patterns, kmp-di, mvi-architecture, android-patterns, gradle-patterns, ktor-patterns, kmp-networking, mobile-testing, kmp-navigation. And that these now exist: compose-animations, koin, android-dev, kmp-ktor, coil-compose, android-testing.
8. Run \`git -C ${AHMED} status --short\` and \`git -C ${AHMED} diff --stat\` and report the overall shape of the change (files changed/added/deleted count) as a sanity check that something substantial and coherent actually happened.

For each numbered check, report pass/fail with the actual grep/read evidence, not a guess. List any remaining issues honestly.`,
  { label: 'final-verify', phase: 'Verify', schema: VERIFY_SCHEMA, agentType: 'general-purpose' }
)

return { prep, execResults, crossCutting, rewire, verify }

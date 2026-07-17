export const meta = {
  name: 'android-skill-merge-audit',
  description: 'Adversarially audit 3 Android/Kotlin skill repos per topic cluster to plan a conflict-free merge',
  phases: [
    { title: 'Audit', detail: 'one finder per cluster reads all skill files, reports contradictions/bugs/unique-value' },
    { title: 'Verify', detail: 'skeptical verifier re-reads files and refutes each claim' },
    { title: 'Synthesize', detail: 'per-cluster merge recommendation from verified findings only' },
    { title: 'Review', detail: 'completeness critic checks cross-cluster conflicts and gaps' },
  ],
}

const AHMED = '/Users/oleksandr.priadko/Documents/StudioProjects/sub/everything-claude-code-mobile/skills'
const CHRIS = '/Users/oleksandr.priadko/Documents/StudioProjects/sub/skills/skills'
const RCOS  = '/Users/oleksandr.priadko/Documents/StudioProjects/sub/android-skills/plugins/android-skills/skills'

function srcList(c) {
  const lines = []
  for (const s of c.sources) {
    const base = s.repo === 'ahmed' ? AHMED : s.repo === 'chris' ? CHRIS : RCOS
    for (const d of s.dirs) lines.push(`- [${s.repo}] ${base}/${d}/  (read SKILL.md AND any references/*.md inside)`)
  }
  let out = lines.join('\n')
  if (c.note) out += `\n\nNOTE: ${c.note}`
  return out
}

function finderPrompt(c) {
  return `You are auditing Android/Kotlin AI-agent "skill" files for the "${c.title}" topic across up to three source repos that are being merged into ONE Claude Code plugin. When multiple skills auto-trigger on the same code, contradictory guidance is a real defect.

Read the FULL content of every SKILL.md in these directories, plus any references/*.md files inside them (use Glob or Bash 'ls -R' first to discover reference files):

${srcList(c)}

Produce:
1. contradictions — cases where two sources give ACTUALLY OPPOSING advice on the SAME specific technical point (not merely different depth or wording of the same principle). Name both sources (labels: "ahmed" / "chris" / "rcosteira"), state each claim, and cite evidence (file path + the specific lines/quote).
2. bugs — code that is broken, will not compile, or is technically WRONG (e.g. catches and swallows CancellationException, loses state across config change, references undefined symbols, wrong plugin/order). severity: critical | major | minor. Cite the file + evidence.
3. depthComparison — which source is most detailed/actionable here and why.
4. uniqueValue — what each source covers that the OTHERS DO NOT (worth keeping regardless of who dominates).

Be precise; cite real file content. Do NOT invent contradictions where sources only differ in depth — that is the most common false positive. Set cluster="${c.key}".`
}

function verifierPrompt(c, findings) {
  return `You are an ADVERSARIAL verifier for the "${c.title}" skill cluster. A prior agent produced the findings below. Your job is to REFUTE them: independently re-read the ACTUAL files (do not trust the findings' quotes) and judge whether each claimed contradiction and bug is real.

Directories (read them yourself; discover references/*.md with Glob or 'ls -R'):
${srcList(c)}

Findings to verify:
${JSON.stringify(findings, null, 2)}

For each contradiction: is it a REAL opposing-advice conflict, or just different depth/context/wording of the same principle? Verdict CONFIRMED | OVERTURNED | PARTIAL, with reasoning citing the actual lines.
For each bug: re-read the cited code. Is it actually broken/wrong in a way that matters? Verdict CONFIRMED | OVERTURNED | PARTIAL.
Also list missedIssues: any real contradiction or bug the finder MISSED that you noticed.

Default to OVERTURNED when you cannot find clear evidence in the files. Be skeptical and specific.`
}

function synthPrompt(c, findings, verdict) {
  return `Produce the final merge recommendation for the "${c.title}" cluster. Use ONLY verified findings — ignore any contradiction/bug the verifier marked OVERTURNED; treat PARTIAL with appropriate nuance; incorporate the verifier's missedIssues.

Finder findings:
${JSON.stringify(findings, null, 2)}

Verifier verdicts:
${JSON.stringify(verdict, null, 2)}

Decide:
- dominant: which source should be the primary/base skill for this topic (label ahmed/chris/rcosteira), or "complementary" if they genuinely cover different sub-areas with no single winner.
- delete: exact skill FOLDER names that are fully redundant, inferior, or buggy and should be removed.
- keepFull: exact folder names to keep as-is.
- partialMerge: specific content to salvage {from, what, into} using folder names.
- manualResolution: genuine design either/or decisions the human must make (NOT correctness bugs — those are already decided).
- confidence: high | medium | low.
Set cluster="${c.key}".`
}

const FINDINGS_SCHEMA = {
  type:'object', additionalProperties:false,
  required:['cluster','filesRead','contradictions','bugs','depthComparison','uniqueValue'],
  properties:{
    cluster:{type:'string'},
    filesRead:{type:'array', items:{type:'string'}},
    contradictions:{type:'array', items:{
      type:'object', additionalProperties:false,
      required:['topic','sourceA','claimA','sourceB','claimB','evidence'],
      properties:{topic:{type:'string'},sourceA:{type:'string'},claimA:{type:'string'},sourceB:{type:'string'},claimB:{type:'string'},evidence:{type:'string'}}
    }},
    bugs:{type:'array', items:{
      type:'object', additionalProperties:false,
      required:['source','file','severity','description','evidence'],
      properties:{source:{type:'string'},file:{type:'string'},severity:{type:'string',enum:['critical','major','minor']},description:{type:'string'},evidence:{type:'string'}}
    }},
    depthComparison:{type:'string'},
    uniqueValue:{type:'array', items:{
      type:'object', additionalProperties:false,
      required:['source','whatIsUnique'],
      properties:{source:{type:'string'},whatIsUnique:{type:'string'}}
    }}
  }
}

const VERDICT_SCHEMA = {
  type:'object', additionalProperties:false,
  required:['contradictionVerdicts','bugVerdicts','missedIssues'],
  properties:{
    contradictionVerdicts:{type:'array', items:{
      type:'object', additionalProperties:false,
      required:['topic','verdict','reasoning'],
      properties:{topic:{type:'string'},verdict:{type:'string',enum:['CONFIRMED','OVERTURNED','PARTIAL']},reasoning:{type:'string'}}
    }},
    bugVerdicts:{type:'array', items:{
      type:'object', additionalProperties:false,
      required:['description','verdict','reasoning'],
      properties:{description:{type:'string'},verdict:{type:'string',enum:['CONFIRMED','OVERTURNED','PARTIAL']},reasoning:{type:'string'}}
    }},
    missedIssues:{type:'array', items:{type:'string'}}
  }
}

const REC_SCHEMA = {
  type:'object', additionalProperties:false,
  required:['cluster','dominant','delete','keepFull','partialMerge','manualResolution','confidence'],
  properties:{
    cluster:{type:'string'},
    dominant:{type:'string'},
    delete:{type:'array', items:{type:'string'}},
    keepFull:{type:'array', items:{type:'string'}},
    partialMerge:{type:'array', items:{
      type:'object', additionalProperties:false,
      required:['from','what','into'],
      properties:{from:{type:'string'},what:{type:'string'},into:{type:'string'}}
    }},
    manualResolution:{type:'array', items:{type:'string'}},
    confidence:{type:'string', enum:['high','medium','low']}
  }
}

const CLUSTERS = [
  { key:'compose', title:'Jetpack Compose UI & state', sources:[
    {repo:'ahmed', dirs:['jetpack-compose']},
    {repo:'chris', dirs:['compose-animations','compose-focus-navigation','compose-modifier-and-layout-style','compose-recomposition-performance','compose-side-effects','compose-slot-api-pattern','compose-stability-diagnostics','compose-state-authoring','compose-state-deferred-reads','compose-state-hoisting','compose-state-holder-ui-split']},
    {repo:'rcosteira', dirs:['compose']}
  ]},
  { key:'coroutines-flow', title:'Kotlin coroutines & Flow', sources:[
    {repo:'ahmed', dirs:['coroutines-patterns','shared-coroutines']},
    {repo:'chris', dirs:['kotlin-coroutines-structured-concurrency','kotlin-flow-state-event-modeling']},
    {repo:'rcosteira', dirs:['kotlin-coroutines','kotlin-flows']}
  ]},
  { key:'expect-actual', title:'KMP expect/actual boundaries', sources:[
    {repo:'ahmed', dirs:['expect-actual']},
    {repo:'chris', dirs:['kotlin-multiplatform-expect-actual']},
    {repo:'rcosteira', dirs:['kmp-boundaries']}
  ]},
  { key:'di-koin', title:'Dependency injection / Koin', sources:[
    {repo:'ahmed', dirs:['koin-patterns','kmp-di']},
    {repo:'rcosteira', dirs:['koin']}
  ]},
  { key:'architecture', title:'App architecture, MVI & modularization', sources:[
    {repo:'ahmed', dirs:['mvi-architecture','android-patterns']},
    {repo:'rcosteira', dirs:['android-dev','modularization']}
  ]},
  { key:'gradle', title:'Gradle build logic & performance', sources:[
    {repo:'ahmed', dirs:['gradle-patterns']},
    {repo:'rcosteira', dirs:['android-gradle-logic','gradle-build-performance']}
  ]},
  { key:'image-loading', title:'Image loading (Coil)', sources:[
    {repo:'ahmed', dirs:['image-loading']},
    {repo:'rcosteira', dirs:['coil-compose']}
  ]},
  { key:'networking', title:'Networking (Retrofit / Ktor)', sources:[
    {repo:'ahmed', dirs:['ktor-patterns','kmp-networking']},
    {repo:'rcosteira', dirs:['android-retrofit','kmp-ktor']}
  ]},
  { key:'data-layer', title:'Data layer: Room, DataStore, offline, SQLDelight, models', sources:[
    {repo:'ahmed', dirs:['room-patterns','kmp-repositories','offline-first','sqldelight-patterns','shared-models']},
    {repo:'rcosteira', dirs:['android-data-layer','datastore']}
  ]},
  { key:'pagination', title:'Pagination', sources:[
    {repo:'ahmed', dirs:['pagination-patterns']},
    {repo:'rcosteira', dirs:['paging']}
  ]},
  { key:'testing', title:'Testing & debugging', sources:[
    {repo:'ahmed', dirs:['mobile-testing','ios-testing','mobile-verification']},
    {repo:'chris', dirs:['compose-ui-testing-patterns']},
    {repo:'rcosteira', dirs:['android-testing','android-debugging']}
  ]},
  { key:'navigation', title:'Navigation & deep linking', sources:[
    {repo:'ahmed', dirs:['navigation-compose','kmp-navigation','deep-linking']},
    {repo:'rcosteira', dirs:['compose']}
  ], note:'rcosteira has no dedicated navigation skill; its only nav content is a references/navigation.md inside the "compose" skill. Read only that reference file for rcosteira (ignore the rest of compose here). If ahmed is effectively the sole source, say so — that is a valid "keep, unique to ahmed" outcome.' },
]

phase('Audit')
const results = await pipeline(
  CLUSTERS,
  (c) => agent(finderPrompt(c), { label:`find:${c.key}`, phase:'Audit', schema:FINDINGS_SCHEMA, agentType:'general-purpose' }),
  (findings, c) => findings
    ? agent(verifierPrompt(c, findings), { label:`verify:${c.key}`, phase:'Verify', schema:VERDICT_SCHEMA, agentType:'general-purpose' })
        .then(v => ({ findings, verdict:v }))
    : null,
  (fv, c) => fv
    ? agent(synthPrompt(c, fv.findings, fv.verdict), { label:`synth:${c.key}`, phase:'Synthesize', schema:REC_SCHEMA, agentType:'general-purpose' })
        .then(rec => ({ cluster:c.key, title:c.title, findings:fv.findings, verdict:fv.verdict, recommendation:rec }))
    : null
)

const clean = results.filter(Boolean)

phase('Review')
const critique = await agent(
  `You are a completeness critic for a plan to merge three Android/Kotlin skill repos (labels: ahmed = everything-claude-code-mobile, chris = chrisbanes/skills, rcosteira = rcosteira79/android-skills) into ONE Claude Code plugin using ahmed's repo as the structural base.

Below are the per-cluster verified findings and merge recommendations from the audit:
${JSON.stringify(clean.map(r => ({cluster:r.cluster, recommendation:r.recommendation, confirmedContradictions:(r.verdict?.contradictionVerdicts||[]).filter(v=>v.verdict!=='OVERTURNED'), confirmedBugs:(r.verdict?.bugVerdicts||[]).filter(v=>v.verdict!=='OVERTURNED'), missed:r.verdict?.missedIssues||[]})), null, 2)}

Assess:
1. Cross-cluster conflicts — any skill recommended to delete in one cluster but relied on in another; any contradictory dominance calls.
2. Coverage gaps — important Android/KMP topics none of the three repos cover well (worth writing from scratch or pulling from the user's own kotlin plugin or Google's official android-cli skills).
3. Risk flags — any HIGH-IMPACT recommendation resting on LOW confidence that deserves a manual re-check before executing.
4. A crisp final verdict: is ahmed still worth using as the BASE (for its agents/commands/hooks/MCP scaffolding) even though most of its skill CONTENT is being replaced? Give a one-paragraph bottom line.

Return a structured markdown report.`,
  { label:'completeness-critic', phase:'Review', agentType:'general-purpose' }
)

return { clusters: clean, critique }

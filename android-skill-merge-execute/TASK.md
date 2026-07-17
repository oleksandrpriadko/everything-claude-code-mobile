# Task: merge three Android/Kotlin/KMP skill repos into one coherent skill set

## Goal

Three separate repos each provide "skills" (Claude Code / AI-agent instruction files) for native Android, Kotlin, and Kotlin Multiplatform development. They overlap heavily in places — the same topic (Compose state, coroutines, DI, architecture) is often covered by two or all three, sometimes in agreement, sometimes contradicting each other, sometimes with outright bugs in the example code.

Evaluate the three repos and produce **one merged, internally-consistent skill set** suitable for use as a single Claude Code plugin for Android/Kotlin/KMP work. Concretely:

1. For every topic where more than one repo has coverage, determine whether the sources **actually contradict** each other on a specific point (not just differ in depth/wording), and whether either source's example code has **real bugs** (won't compile, wrong API usage, swallowed exceptions, etc.) — verify by reading the actual files, not by title/description alone.
2. Decide, per topic, what to keep, what to delete, and what to merge/salvage from the losing source into the winner.
3. Produce the actual merged result — not just a plan. Execute the deletes/merges/fixes as real file changes.
4. Flag anything that's a genuine design/taste decision (not a correctness bug) rather than silently picking a side.

## Source repos (pinned — do not pull latest; use these exact commits)

All three are already cloned locally on this machine:

| Repo | Local path | Origin (fork) | Pinned commit |
|---|---|---|---|
| Chris Banes' Compose/Kotlin skills | `~/Documents/StudioProjects/sub/skills` | github.com/oleksandrpriadko/skills (fork of chrisbanes/skills) | `1290b051d29f81929fec3a09ec5fc8caf96b4555` |
| rcosteira79's Android/KMP skills | `~/Documents/StudioProjects/sub/android-skills` | github.com/oleksandrpriadko/android-skills (fork of rcosteira79/android-skills) | `a1356d7e7223015dba40235010d199375a2c1213` |
| ahmed3elshaer's mobile plugin | `~/Documents/StudioProjects/sub/everything-claude-code-mobile` | github.com/oleksandrpriadko/everything-claude-code-mobile (fork of ahmed3elshaer/everything-claude-code-mobile) | `d94b24037d719bf64794cd385e99fa775a8de428` (this is `main` — do your work on a new branch, don't commit to `main`) |

Note: the third repo (`everything-claude-code-mobile`) is not just skills — it also ships 27 agents, 35 commands, hooks, and 3 MCP servers (an orchestration layer, not just reference content). Whether/how to use that layer is part of the judgment call — nothing here prescribes an answer.

## Deliverable

A real, executed merge — actual files changed on disk (branch, not `main`), not just a report. If useful, also produce a written summary of what was found/decided/fixed, but the file changes are the actual deliverable.

## About this folder

This folder (`android-skill-merge-audit/`) and its sibling `android-skill-merge-execute/` contain **a previous attempt at this exact task** (workflow scripts, per-agent transcripts, and final results) — kept for comparison, **not** as a hint. If you're attempting this task fresh, don't read the other files in these two folders until after you've produced your own independent result — the point is to compare two independent attempts, not to anchor on one.

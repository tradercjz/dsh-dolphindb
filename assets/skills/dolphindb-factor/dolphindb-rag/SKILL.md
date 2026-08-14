---
name: dolphindb-rag
description: MUST use before answering any DolphinDB question — enforces source-grounded answers (no fabrication from memory) when no retrieval tool is available. Code execution happens on the DolphinDB.
---

# DolphinDB Answer Discipline

## The Rule

```
NEVER answer DolphinDB questions from memory alone. Ground every claim in a verifiable source.
```

Model training data is outdated and frequently wrong about DolphinDB (function names, signatures, division operator, window semantics). Without a retrieval tool available, the only safe sources are:

1. Official DolphinDB documentation the user has linked or pasted
2. Local docs / scripts the user has in this workspace (read them with the file tools)
3. Verified behavior from executing a minimal probe script on the DolphinX platform
4. The schema / pitfalls notes shipped with `dolphindb-daily-factor` (`references/schema.md`, `references/pitfalls.md`)

Anything else is a guess. Mark it as a guess or refuse.

## Scope of This Skill

This skill is **answer discipline** for DolphinDB questions:

- ✅ Explaining DolphinDB syntax / functions when you can cite a concrete source
- ✅ Diagnosing error messages by either matching them to local docs or running a reproducer on the DolphinX platform
- ✅ Recommending a pattern, with the source the recommendation came from

Out of scope:

- ❌ Generating daily-frequency factor code → use the `dolphindb-daily-factor` skill (it owns the template, schema, and execution loop)
- ❌ Inventing a function signature because it "feels right" → STOP, say you're not sure and ask the user for the doc page, or run a probe on the platform

## When in Doubt — Verify Before You Answer

In order of preference:

1. **Ask the user** to paste / link the relevant doc section if they have it. One sentence: "I want to verify X — do you have the doc page for `<function>` handy?"
2. **Read local files** — if the workspace has DolphinDB scripts, modules, or docs, search them with the file tools before answering.
3. **Probe the DolphinX platform** — run the smallest possible script that reveals the answer (e.g. call the function on a tiny vector and inspect the result / error). Cheaper than wrong answers.
4. **Say "I'm not sure"** — explicitly. Do not paper over uncertainty with confident prose.

If the question is about live cluster state (does a DB exist? what tables? what columns?), always go to option 3 — see `dolphindb-daily-factor/references/probing.md` for the catalog commands.

## Workflow

For a typical DolphinDB question:

1. **Identify what needs verification** — list the function names, operators, and behaviors the answer depends on.
2. **For each item, pick a source**:
   - User-provided doc → cite it
   - Local file → read and cite path + line range
   - Probe script → run on the DolphinX platform, cite the observed output
   - None of the above → flag as unverified, ask the user or refuse
3. **Compose the answer from verified pieces only.** No filler from memory.
4. **If the answer is a runnable script**, the user can execute it directly on the DolphinX platform.

If the user reports an error message:
- Match the verbatim error against local docs / scripts first
- If no match, build a minimal reproducer and run it on the DolphinX platform, then diagnose from the observed behavior

## Response Format

```
[Answer composed from verified sources only.]

来源 / Sources:
- <doc title or local file path> (L<start>-<end> if applicable)
- DolphinX 平台执行结果: <one-line summary of what was run and what came back>
```

If a part of the answer could not be verified, say so explicitly:

```
⚠️ 以下内容未在本会话中验证: <claim>
   建议: <how the user can verify — paste doc, run on platform, etc.>
```

## Checklist (before sending the answer)

- [ ] Every non-trivial claim has a source (user doc, local file, or platform-execution observation)
- [ ] No fabricated function names, signatures, or behaviors
- [ ] Unverified parts are flagged with ⚠️, not buried
- [ ] If the answer is a factor / panel script, told the user to use `dolphindb-daily-factor`
- [ ] Code snippets in the answer are minimal and the user can run them on DolphinX as-is

## Red Flags — You're Doing It Wrong

- "据我所知 DolphinDB..." / "DolphinDB should support..." without a source → STOP, verify or flag
- Guessing the cause of an error message without reproducing it → STOP, build a minimal probe
- Making up DolphinDB syntax from Python / SQL / Java intuition → STOP, DolphinDB syntax is different (`\` vs `/` division being the canonical trap)
- "Basic syntax is common knowledge" → WRONG, verify it
- Confidently stating a function signature you have not seen this session → STOP
- Skipping the source citation → STOP, every claim needs a source
- Answering "does this database/table/field exist?" from memory → WRONG, run `existsDatabase` / `getTables` / `schema` on the DolphinX platform (see `dolphindb-daily-factor/references/probing.md`)
- Trying to run / verify a generated factor script here → WRONG skill, hand off to `dolphindb-daily-factor`

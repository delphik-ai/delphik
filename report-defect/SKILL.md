---
name: report-defect
description: Report a defect in an AI benchmark TASK to Delphik. Use when, while running an eval (e.g. `harbor run`), you notice the benchmark task itself is broken — wrong gold test, impossible instruction, info leakage, env/setup bug — not your agent's mistake. Bundles task id + root-cause note + optional failing trajectory.
---

# /report-defect

Report — in one line — when you believe a benchmark **task itself is broken** (e.g. your model/harness was unfairly scored as failing).

## Procedure
1. **Analyze** — Read the trajectory of the most recent session/run and pin down, as a first pass, *which task* is broken and *why*. If it came from `harbor run -d <dataset>@<ref>`, also read the **`ref` (version)** so the report is attributed to that version (B1).
2. **Confirm** — Ask the user, in plain language, to confirm:
   - task · root cause · (optional) suggested fix
   - Notice that **"this trajectory will be made public — if it's sensitive, you can send the reason only and leave it out"** (optional).
   - (Enter = send / type to edit)
3. **Send** — Once confirmed, run `scripts/submit.mjs`. Inputs come from environment variables or arguments:
   `DELPHIK_TASK_ID`, `DELPHIK_DESC`, (opt) `DELPHIK_FIX`, `DELPHIK_TRAJECTORY` (path to a JSON file), `DELPHIK_MODEL`, `DELPHIK_HARNESS`, `DELPHIK_REF`.
4. **Result** — When you get `{defect_id}`, tell the user: "Reported · under review · track it at posttrain.dev/tasks/<task_id>".

> Principle: the user should be done with **one `/report-defect` + one Enter**. The agent drafts the description; the user only confirms or edits.

## Auth (first time only)
If `~/.delphik/token` is missing: tell the user to open **https://posttrain.dev/skill-auth** in a browser, sign in with GitHub, and save the `dpk_...` token shown on screen into `~/.delphik/token`. Silent afterward. (Shared by both skills.)

## Endpoint
`POST https://posttrain.dev/api/report` · `Authorization: Bearer dpk_...`
```json
{ "task_id": "...", "description": "...", "fix_suggestion": "(opt)",
  "trajectory": { "steps": [...] }, "model_name": "(opt)", "harness_name": "(opt)", "harbor_ref": "(opt)" }
```
Response `201 { defect_id }`. (Spec: docs/v4/back/skill.md)

---
name: contribute-trajectory
description: Donate your benchmark run trajectories to Delphik's open dataset. Use when you've run evals (e.g. `harbor run`) and want to contribute the agent trajectories (pass or fail) to the public dataset — no defect needed. Discovers Harbor `jobs/` runs, lets you pick which to upload, maps each to its task automatically.
---

# /contribute-trajectory

Donate your own eval run trajectories to the open dataset (no defect required). Failures are especially valuable.

## Procedure (agentic discovery)
1. **Scan** — When run without arguments, find the **`jobs/` directory** in the current repo. `harbor run` stores each run at `jobs/<job>/<trial>/agent/trajectory.json` (ATIF) + `verifier/reward.txt` (result) + `config.json` (task/dataset/ref). If there's no `jobs/`, ask the user where it is.
2. **Show status** — List each trial in a table: `# · task · benchmark · model · result · when`. (Parsed from config.json and reward.txt.)
3. **Select** — The user picks in plain language ("all the failures", "1,2,4", "everything").
4. **Map & confirm** — Map each trajectory to its (task, harbor_ref) automatically. Run a **lightweight secret scan** (`ghp_` / `sk-` / `API_KEY=` / `.env` lines) → report "N entries masked" and confirm.
5. **Upload** — Run `scripts/submit.mjs` (sends the selection to `POST /api/contribute` as a batch).

## Auth
Uses the **same token** as report-defect (`~/.delphik/token`). If missing, point the user to https://posttrain.dev/skill-auth.

## Endpoint
`POST https://posttrain.dev/api/contribute` · `Authorization: Bearer dpk_...`
```json
{ "items": [ { "task_ref": "<harbor_task_ref>", "harbor_ref": "@2.0",
              "trajectory": { "steps": [...] }, "model_name": "...", "harness_name": "...", "scored_result": "fail" } ] }
```
Response `201 { uploaded:[...], skipped:[{task, reason}] }`. (Spec: docs/v4/back/skill-contribute.md)

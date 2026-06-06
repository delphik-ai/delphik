---
name: report-defect
description: Report a defect in an AI benchmark TASK to Delphik. Use when, while running an eval (e.g. `harbor run`), you notice the benchmark task itself is broken — wrong gold test, impossible instruction, info leakage, env/setup bug — not your agent's mistake. Bundles task id + root-cause note + optional failing trajectory.
---

# /report-defect

Report — in one line — when you believe a benchmark **task itself is broken** (e.g. your model/harness was unfairly scored as failing).

All URLs below use the shell expansion **`${DELPHIK_API:-https://posttrain.dev}`** — paste it verbatim into every `curl` and any URL you show the user. The shell resolves it to the Delphik server.

## Procedure
1. **Analyze** — Read the trajectory of the most recent session/run and pin down **which benchmark + task** is broken and *why*. Note:
   - (a) the **benchmark** (its GitHub repo or name, e.g. `SWE-bench/SWE-bench`).
   - (b) the **task's upstream id** the run used (e.g. `astropy__astropy-12907`, `task-6902ef…`).
     **Where to look** (Harbor convention, in order of authority):
       1. The task's **`task.toml`** — the canonical harbor task definition. Look for `id` / `name` / `instance_id`. Usually lives next to the task's source files in the benchmark repo (e.g. `<benchmark>/tasks/<task-folder>/task.toml`). **Trust this over anything else.**
       2. `config.json` / `result.json` / `info.json` in the trial root — typically carries `task_id` / `instance_id` copied from task.toml at runtime.
       3. The trajectory file itself — ATIF-shape payloads may include it under `info` / `metadata`.
       4. The trial directory **path** — `outputs/<run>/<task-id>/agent/trajectory.json` — fallback only; folder names are not guaranteed to match the canonical id.
   - (c) repo / base commit / failing test (for matching when the id alone is ambiguous).
   - If from `harbor run -d <dataset>@<ref>`, also read the **`ref`** (the version).
2. **Resolve the task** — the upstream id is often formatted differently inside Delphik (adapters add prefixes/suffixes like `instance_…-v<sha>`, or use synthesized ids), so **don't guess — look it up** via the public catalog:
   - `curl -s "${DELPHIK_API:-https://posttrain.dev}/api/benchmarks"` → this returns a benchmark array. Pick the benchmark whose `github_repo` / `name` / `display_name` matches what you ran → take its **`name`**.
   - `curl -s "${DELPHIK_API:-https://posttrain.dev}/api/tasks?benchmark=<name>&include_all_tasks=1"` → this returns `{ tasks: [...] }`. In `tasks[]`, find the entry whose `task_name` corresponds to the user's task (allow for prefix/suffix/separator differences; use repo/commit/test to be sure) → take its **`id`** (the Delphik task id).
   - **Benchmark not in Delphik** → tell the user *"Delphik doesn't cover **<benchmark>** yet"* and ask if they want to **send their trajectory to the Delphik admin so it can be added**. If yes, run `scripts/request-benchmark.mjs` (env: `DELPHIK_BENCHMARK` or `DELPHIK_REPO`, `DELPHIK_DESC`, opt `DELPHIK_TASK` / `DELPHIK_TRAJECTORY` / `DELPHIK_MODEL` / `DELPHIK_HARNESS`) → then **stop** (there's no catalog task to file against).
   - **Task not found** in a known benchmark → ask the user for the task link/name.
   - (The catalog endpoints are **public — no token needed**.)
3. **Confirm the target** — show the matched **benchmark · task** and confirm it's the right one: *"Report a defect on **<benchmark> / <task>**?"*
4. **Gather the defect**
   - **Description** (root cause): you may draft a starting version from the run, but **always show it to the user verbatim and wait for explicit "ok" or edits before treating it as final**. Don't paraphrase your own draft when summarising — show the actual text you're about to send.
   - **Fix suggestion** (optional): **default to omitting it**. Only include one if (a) the user explicitly asks for it, or (b) you ask "Add a fix suggestion?" and the user says yes — then show your draft + wait for ok/edits. Reports go to maintainers under the user's name; never invent a technical recommendation they haven't approved.
   - **Trajectory (evidence — strongly preferred; it's what makes the report credible):**
     - **Find it**: search the run's output for the trajectory file, e.g. `find . -path '*run*/agent/*trajectory*.json'` (also try `*.trajectory.json`, `trajectory.json`, the harness's output dir).
     - **If you can't find one, ASK the user** whether they have a trajectory file and where it is — don't silently fall back to reason-only.
     - **Show the chosen path and confirm before continuing**: tell the user *"I'll attach `<absolute path>` (<size>). The trajectory will be made public — if it's sensitive, say so and I'll send the reason only."* Wait for them to confirm (or skip).
     - **Attach as-is** — pass the path as `DELPHIK_TRAJECTORY`. Don't normalize / convert / repackage the file; Delphik converts it server-side.
5. **Final preview + send** — write the report as a JSON file, **show the user the full contents you're about to send** (target benchmark/task + description + fix_suggestion if any + trajectory path), wait for one more explicit "ok / send it", then pass the file path to `scripts/submit.mjs`. No silent submits.
   ```bash
   cat > /tmp/delphik-report.json <<'JSON'
   { "task_id": "<resolved Delphik id from step 2 — or upstream instance_id + benchmark below>",
     "benchmark": "<name or github repo>",
     "description": "<the exact text the user approved in step 4>",
     "fix_suggestion": "<only if user opted in; otherwise omit the field>",
     "trajectory_file": "<absolute path the user confirmed in step 4>",
     "model": "<optional>", "harness": "<optional>", "ref": "<optional, harbor_ref>" }
   JSON
   # Show the user: `cat /tmp/delphik-report.json` (or echo back the key fields), wait for ok.
   node scripts/submit.mjs /tmp/delphik-report.json
   ```
   (Stdin also works: `cat report.json | node scripts/submit.mjs -`. Env vars `DELPHIK_*` still work for short one-shot calls but are awkward for descriptions with quotes / newlines.)
6. **Result** — On `201`, tell the user: *"Reported · under review."* It's now in triage; once accepted it's routed upstream for a fix. Show the tracking link with `echo "${DELPHIK_API:-https://posttrain.dev}/me"`. If they have other eval runs, they can donate them to the open dataset with the `contribute-trajectory` skill (`npx skills add delphik-ai/delphik --skill contribute-trajectory`).

> Principle: keep friction minimal — the agent does the catalog lookup + drafts the description; the user just confirms the target, then the details.

## Auth (first time only)
If `submit.mjs` exits with **`NEEDS_SIGNIN  run-script: <path>`**, do this (don't block your own bash tool, don't ask the user to run anything in their terminal):

1. **Launch `<path>` (the printed `login.mjs`) in the BACKGROUND** — use the Bash tool's `run_in_background: true` so the loopback server stays alive across your turns. Capture the shell id.
2. **Read the script's printed URL** (it'll be `${DELPHIK_API:-https://posttrain.dev}/skill-auth?callback=…&state=…`) and **show it to the user**: *"Sign in here: <url> — click 'Continue with GitHub'. Tell me when the page says '✓ Signed in'."* The browser also opens automatically; the URL is the fallback if it didn't.
3. **Wait for the user's confirmation** (or poll the background shell's output for `✓ Signed in. Token saved`). Don't spin — the user clicks at their own pace.
4. **Re-run `submit.mjs`** — the token is now at the per-host path (`~/.delphik/token` or `token.dev`) and the call succeeds.

Silent on every subsequent call. (Token shared by both skills.)

## Endpoint
`POST ${DELPHIK_API:-https://posttrain.dev}/api/report` · `Authorization: Bearer dpk_...`
```json
{ "task_id": "<Delphik task id, or upstream instance_id>", "description": "...", "fix_suggestion": "(opt)",
  "benchmark": "(opt — name or github repo, disambiguates the instance_id)",
  "trajectory": { "...raw trajectory.json — server converts..." },
  "model_name": "(opt)", "harness_name": "(opt)", "harbor_ref": "(opt)" }
```
Response `201 { defect_id, task_id }`.

#!/usr/bin/env node
// Delphik /report-defect submit.
//
// Reads token (DELPHIK_TOKEN env, else ~/.delphik/token{,.dev}) and POSTs /api/report.
//
// Inputs (preferred: JSON file or stdin — avoids shell-escaping multi-line description / fix):
//   node submit.mjs <path-to-report.json>     # JSON in a file
//   cat report.json | node submit.mjs -       # JSON on stdin
//   node submit.mjs                            # legacy: env vars (DELPHIK_* below)
//
// JSON schema (all fields the API accepts):
//   { "task_id": "<Delphik UUID or upstream instance_id>",
//     "description": "...", "fix_suggestion": "(opt)",
//     "benchmark": "(opt — name or github repo, disambiguates the instance_id)",
//     "trajectory_file": "/abs/path/to/trajectory.json"  // we read+parse this for you
//     // or: "trajectory": { ...inline json... }
//     "model": "(opt)", "harness": "(opt)", "ref": "(opt — harbor ref)" }
//
// Env var fallback (kept for older callers): DELPHIK_TASK_ID, DELPHIK_DESC, DELPHIK_FIX,
//   DELPHIK_BENCHMARK, DELPHIK_TRAJECTORY (path), DELPHIK_MODEL, DELPHIK_HARNESS, DELPHIK_REF.
// Server selector: DELPHIK_API (default https://posttrain.dev). Token override: DELPHIK_TOKEN.

import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const API = process.env.DELPHIK_API || 'https://posttrain.dev'
const tokenPath = join(homedir(), '.delphik', /localhost|127\.0\.0\.1/.test(API) ? 'token.dev' : 'token')

// --- token ---
const tokenFromEnv = Boolean(process.env.DELPHIK_TOKEN?.trim())
let token = process.env.DELPHIK_TOKEN?.trim()
if (!token) {
  try { token = readFileSync(tokenPath, 'utf8').trim() } catch {
    const loginScript = new URL('./login.mjs', import.meta.url).pathname
    if (process.stdout.isTTY) {
      // Direct terminal use — block on the loopback flow. Opens browser + waits up to 5 min.
      const { spawnSync } = await import('node:child_process')
      console.error('No token found. Opening browser to sign in…')
      const r = spawnSync(process.execPath, [loginScript], { stdio: 'inherit', env: process.env })
      if (r.status !== 0) { console.error('Sign-in did not complete.'); process.exit(2) }
      try { token = readFileSync(tokenPath, 'utf8').trim() } catch { process.exit(2) }
    } else {
      console.error(`NEEDS_SIGNIN  run-script: ${loginScript}
Agent: launch this script with run_in_background:true (Bash tool), read the printed
sign-in URL, ask the user to click "Continue with GitHub", wait for the background log to
show "✓ Signed in", then re-run me. The token is saved to ${tokenPath} automatically.`)
      process.exit(2)
    }
  }
}

// --- inputs: prefer JSON (file path or stdin), fall back to env vars ---
async function readStdin() {
  let buf = ''
  for await (const c of process.stdin) buf += c
  return buf
}

const arg = process.argv[2]
let input = {}
if (arg && arg !== '-') {
  try { input = JSON.parse(readFileSync(arg, 'utf8')) }
  catch (e) { console.error(`Bad JSON file ${arg}: ${(e instanceof Error ? e.message : e)}`); process.exit(2) }
} else if (arg === '-' || !process.stdin.isTTY) {
  const s = (await readStdin()).trim()
  if (s) {
    try { input = JSON.parse(s) }
    catch (e) { console.error(`Bad JSON on stdin: ${(e instanceof Error ? e.message : e)}`); process.exit(2) }
  }
}

const taskId          = input.task_id        ?? process.env.DELPHIK_TASK_ID
const description     = input.description    ?? process.env.DELPHIK_DESC
const fixSuggestion   = input.fix_suggestion ?? process.env.DELPHIK_FIX
const benchmark       = input.benchmark      ?? process.env.DELPHIK_BENCHMARK
const trajectoryFile  = input.trajectory_file?? process.env.DELPHIK_TRAJECTORY
const modelName       = input.model          ?? process.env.DELPHIK_MODEL
const harnessName     = input.harness        ?? process.env.DELPHIK_HARNESS
const harborRef       = input.ref            ?? process.env.DELPHIK_REF

if (!taskId || !description) {
  console.error('task_id and description are required (either in the JSON input or DELPHIK_TASK_ID / DELPHIK_DESC env)')
  process.exit(2)
}

let trajectory = input.trajectory
if (!trajectory && trajectoryFile) {
  try { trajectory = JSON.parse(readFileSync(trajectoryFile, 'utf8')) }
  catch (e) { console.error(`Could not read trajectory ${trajectoryFile}: ${(e instanceof Error ? e.message : e)}`) }
}

const body = {
  task_id: taskId,
  description,
  fix_suggestion: fixSuggestion || undefined,
  benchmark: benchmark || undefined,
  trajectory,
  model_name: modelName || undefined,
  harness_name: harnessName || undefined,
  harbor_ref: harborRef || undefined,
}

const res = await fetch(`${API}/api/report`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
  body: JSON.stringify(body),
})
const json = await res.json().catch(() => ({}))
if (res.status === 401) {
  const loginScript = new URL('./login.mjs', import.meta.url).pathname
  const tokenLabel = tokenFromEnv ? 'The DELPHIK_TOKEN env value' : `The stored token at ${tokenPath}`
  console.error(`NEEDS_SIGNIN  run-script: ${loginScript}
${tokenLabel} is no longer accepted (${json.error || '401 unauthorized'}).
Agent: launch this script with run_in_background:true (Bash tool), read the printed
sign-in URL, ask the user to click "Continue with GitHub", wait for the background log to
show "✓ Signed in", then re-run me. The token is overwritten in place.`)
  process.exit(2)
}
if (!res.ok) { console.error(`Report failed (${res.status}):`, json.error || ''); process.exit(1) }
console.log(`Reported · defect ${json.defect_id} · under review`)
console.log(`Track your reports: ${API}/me   ·   task: ${API}/tasks/${json.task_id || taskId}`)
console.log(`\nGot other eval runs? Donate them to the open dataset:`)
console.log(`  npx skills add delphik-ai/delphik --skill contribute-trajectory`)

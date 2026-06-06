#!/usr/bin/env node
// Delphik /contribute-trajectory submit. Reads token and POSTs /api/contribute (batch).
// Inputs = JSON file/stdin preferred:
//   node submit.mjs <items.json>
//   cat items.json | node submit.mjs -
// Legacy fallback: DELPHIK_ITEMS=file path.
// Items shape: [{task_ref|task_id, harbor_ref, trajectory, model_name, harness_name, scored_result}]
// DELPHIK_API defaults to https://posttrain.dev. DELPHIK_TOKEN overrides the token file.
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const API = process.env.DELPHIK_API || 'https://posttrain.dev'
// Per-environment token file (localhost → token.dev, else token) so dev never reuses the prod token.
const tokenPath = join(homedir(), '.delphik', /localhost|127\.0\.0\.1/.test(API) ? 'token.dev' : 'token')

const tokenFromEnv = Boolean(process.env.DELPHIK_TOKEN?.trim())
let token = process.env.DELPHIK_TOKEN?.trim()
if (!token) {
  try { token = readFileSync(tokenPath, 'utf8').trim() } catch {
    const loginScript = new URL('../../report-defect/scripts/login.mjs', import.meta.url).pathname
    console.error(`NEEDS_SIGNIN  run-script: ${loginScript}
Agent: launch this script with run_in_background:true (Bash tool), read the printed
sign-in URL, ask the user to click "Continue with GitHub", wait for the background log to
show "✓ Signed in", then re-run me. The token is saved to ${tokenPath} automatically.`)
    process.exit(2)
  }
}

async function readStdin() {
  let buf = ''
  for await (const c of process.stdin) buf += c
  return buf
}

const arg = process.argv[2]
let items
if (arg && arg !== '-') {
  try { items = JSON.parse(readFileSync(arg, 'utf8')) }
  catch (e) { console.error(`Failed to parse items JSON file ${arg}: ${(e instanceof Error ? e.message : e)}`); process.exit(2) }
} else if (arg === '-' || !process.stdin.isTTY) {
  const s = (await readStdin()).trim()
  if (s) {
    try { items = JSON.parse(s) }
    catch (e) { console.error(`Failed to parse items JSON on stdin: ${(e instanceof Error ? e.message : e)}`); process.exit(2) }
  }
}

if (!items && process.env.DELPHIK_ITEMS) {
  try { items = JSON.parse(readFileSync(process.env.DELPHIK_ITEMS, 'utf8')) }
  catch (e) { console.error(`Failed to parse DELPHIK_ITEMS JSON: ${(e instanceof Error ? e.message : e)}`); process.exit(2) }
}
if (!items) { console.error('items JSON is required (file path arg, stdin, or DELPHIK_ITEMS path)'); process.exit(2) }
if (!Array.isArray(items) || items.length === 0) { console.error('items is empty'); process.exit(2) }

const res = await fetch(`${API}/api/contribute`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
  body: JSON.stringify({ items }),
})
const json = await res.json().catch(() => ({}))
if (res.status === 401) {
  const loginScript = new URL('../../report-defect/scripts/login.mjs', import.meta.url).pathname
  const tokenLabel = tokenFromEnv ? 'The DELPHIK_TOKEN env value' : `The stored token at ${tokenPath}`
  console.error(`NEEDS_SIGNIN  run-script: ${loginScript}
${tokenLabel} is no longer accepted (${json.error || '401 unauthorized'}).
Agent: launch this script with run_in_background:true (Bash tool), read the printed
sign-in URL, ask the user to click "Continue with GitHub", wait for the background log to
show "✓ Signed in", then re-run me. The token is overwritten in place.`)
  process.exit(2)
}
if (!res.ok) { console.error(`Contribution failed (${res.status}):`, json.error || ''); process.exit(1) }
console.log(`Contributed · ${json.uploaded?.length ?? 0} uploaded, ${json.skipped?.length ?? 0} skipped`)
for (const s of json.skipped ?? []) console.log(`  skip ${s.task}: ${s.reason}`)

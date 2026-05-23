#!/usr/bin/env node
// Delphik /contribute-trajectory submit. Reads token and POSTs /api/contribute (batch).
// Inputs = DELPHIK_ITEMS (file path, JSON array [{task_ref|task_id, harbor_ref, trajectory, model_name, harness_name, scored_result}])
//          DELPHIK_API (default https://posttrain.dev)
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const API = process.env.DELPHIK_API || 'https://posttrain.dev'
const tokenPath = join(homedir(), '.delphik', 'token')

let token
try { token = readFileSync(tokenPath, 'utf8').trim() } catch {
  console.error(`No token. Sign in at ${API}/skill-auth, then save the dpk_ token to ${tokenPath}.`)
  process.exit(2)
}

const itemsPath = process.env.DELPHIK_ITEMS
if (!itemsPath) { console.error('DELPHIK_ITEMS (path to a JSON array file) is required'); process.exit(2) }
let items
try { items = JSON.parse(readFileSync(itemsPath, 'utf8')) } catch { console.error('Failed to parse items JSON'); process.exit(2) }
if (!Array.isArray(items) || items.length === 0) { console.error('items is empty'); process.exit(2) }

const res = await fetch(`${API}/api/contribute`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
  body: JSON.stringify({ items }),
})
const json = await res.json().catch(() => ({}))
if (!res.ok) { console.error(`Contribution failed (${res.status}):`, json.error || ''); process.exit(1) }
console.log(`Contributed · ${json.uploaded?.length ?? 0} uploaded, ${json.skipped?.length ?? 0} skipped`)
for (const s of json.skipped ?? []) console.log(`  skip ${s.task}: ${s.reason}`)

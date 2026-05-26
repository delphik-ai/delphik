#!/usr/bin/env node
// Delphik benchmark request — when the benchmark isn't in the Delphik catalog, forward the
// reporter's trajectory to the admin so it can be added. POSTs /api/benchmark-request.
// Inputs = env vars: DELPHIK_BENCHMARK (or DELPHIK_REPO), DELPHIK_DESC, (opt) DELPHIK_TASK,
//          DELPHIK_TRAJECTORY (file path), DELPHIK_MODEL, DELPHIK_HARNESS,
//          DELPHIK_API (default https://posttrain.dev), DELPHIK_TOKEN (overrides token file — dev)
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const API = process.env.DELPHIK_API || 'https://posttrain.dev'
// Per-environment token file (localhost → token.dev, else token) so dev never reuses the prod token.
const tokenPath = join(homedir(), '.delphik', /localhost|127\.0\.0\.1/.test(API) ? 'token.dev' : 'token')

let token = process.env.DELPHIK_TOKEN?.trim()
if (!token) {
  try { token = readFileSync(tokenPath, 'utf8').trim() } catch {
    console.error(`No token. Set DELPHIK_TOKEN, or sign in at ${API}/skill-auth and save the dpk_ token to ${tokenPath}.`)
    process.exit(2)
  }
}

const benchmark = process.env.DELPHIK_BENCHMARK
const repo = process.env.DELPHIK_REPO
if (!benchmark && !repo) { console.error('DELPHIK_BENCHMARK or DELPHIK_REPO is required'); process.exit(2) }

let trajectory
if (process.env.DELPHIK_TRAJECTORY) {
  try { trajectory = JSON.parse(readFileSync(process.env.DELPHIK_TRAJECTORY, 'utf8')) } catch { /* opt */ }
}

const body = {
  benchmark: benchmark || undefined,
  repo: repo || undefined,
  task: process.env.DELPHIK_TASK || undefined,
  description: process.env.DELPHIK_DESC || undefined,
  trajectory,
  model_name: process.env.DELPHIK_MODEL || undefined,
  harness_name: process.env.DELPHIK_HARNESS || undefined,
}

const res = await fetch(`${API}/api/benchmark-request`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
  body: JSON.stringify(body),
})
if (!res.ok) {
  const j = await res.json().catch(() => ({}))
  console.error(`Benchmark request failed (${res.status}):`, j.error || '')
  process.exit(1)
}
console.log(`Sent to the Delphik admin — they'll review adding "${benchmark || repo}". Thanks!`)

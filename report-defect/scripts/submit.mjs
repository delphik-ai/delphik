#!/usr/bin/env node
// Delphik /report-defect submit. 토큰(~/.delphik/token) 읽어 POST /api/report.
// 입력 = 환경변수: DELPHIK_TASK_ID, DELPHIK_DESC, (opt) DELPHIK_FIX, DELPHIK_TRAJECTORY(파일경로),
//        DELPHIK_MODEL, DELPHIK_HARNESS, DELPHIK_REF, DELPHIK_API(기본 https://posttrain.dev)
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const API = process.env.DELPHIK_API || 'https://posttrain.dev'
const tokenPath = join(homedir(), '.delphik', 'token')

let token
try { token = readFileSync(tokenPath, 'utf8').trim() } catch {
  console.error(`No token. 먼저 ${API}/skill-auth 에서 GitHub 로그인 → dpk_ 토큰을 ${tokenPath} 에 저장하세요.`)
  process.exit(2)
}

const taskId = process.env.DELPHIK_TASK_ID
const description = process.env.DELPHIK_DESC
if (!taskId || !description) { console.error('DELPHIK_TASK_ID, DELPHIK_DESC 필요'); process.exit(2) }

let trajectory
if (process.env.DELPHIK_TRAJECTORY) {
  try { trajectory = JSON.parse(readFileSync(process.env.DELPHIK_TRAJECTORY, 'utf8')) } catch { /* opt */ }
}

const body = {
  task_id: taskId,
  description,
  fix_suggestion: process.env.DELPHIK_FIX || undefined,
  trajectory,
  model_name: process.env.DELPHIK_MODEL || undefined,
  harness_name: process.env.DELPHIK_HARNESS || undefined,
  harbor_ref: process.env.DELPHIK_REF || undefined,
}

const res = await fetch(`${API}/api/report`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
  body: JSON.stringify(body),
})
const json = await res.json().catch(() => ({}))
if (!res.ok) { console.error(`신고 실패 (${res.status}):`, json.error || ''); process.exit(1) }
console.log(`신고됨 · defect ${json.defect_id} · under review`)
console.log(`진행상황: ${API}/tasks/${taskId}`)

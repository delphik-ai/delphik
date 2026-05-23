#!/usr/bin/env node
// Delphik /contribute-trajectory submit. 토큰 읽어 POST /api/contribute (batch).
// 입력 = DELPHIK_ITEMS(파일경로, JSON 배열 [{task_ref|task_id, harbor_ref, trajectory, model_name, harness_name, scored_result}])
//        DELPHIK_API(기본 https://posttrain.dev)
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const API = process.env.DELPHIK_API || 'https://posttrain.dev'
const tokenPath = join(homedir(), '.delphik', 'token')

let token
try { token = readFileSync(tokenPath, 'utf8').trim() } catch {
  console.error(`No token. ${API}/skill-auth 에서 로그인 → dpk_ 토큰을 ${tokenPath} 에 저장하세요.`)
  process.exit(2)
}

const itemsPath = process.env.DELPHIK_ITEMS
if (!itemsPath) { console.error('DELPHIK_ITEMS (JSON 배열 파일경로) 필요'); process.exit(2) }
let items
try { items = JSON.parse(readFileSync(itemsPath, 'utf8')) } catch { console.error('items JSON 파싱 실패'); process.exit(2) }
if (!Array.isArray(items) || items.length === 0) { console.error('items 비어있음'); process.exit(2) }

const res = await fetch(`${API}/api/contribute`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
  body: JSON.stringify({ items }),
})
const json = await res.json().catch(() => ({}))
if (!res.ok) { console.error(`기부 실패 (${res.status}):`, json.error || ''); process.exit(1) }
console.log(`기부됨 · ${json.uploaded?.length ?? 0}건 업로드, ${json.skipped?.length ?? 0}건 스킵`)
for (const s of json.skipped ?? []) console.log(`  skip ${s.task}: ${s.reason}`)

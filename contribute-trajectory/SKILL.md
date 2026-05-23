---
name: contribute-trajectory
description: Donate your benchmark run trajectories to Delphik's open dataset. Use when you've run evals (e.g. `harbor run`) and want to contribute the agent trajectories (pass or fail) to the public dataset — no defect needed. Discovers Harbor `jobs/` runs, lets you pick which to upload, maps each to its task automatically.
---

# /contribute-trajectory

자기 eval run trajectory를 open 데이터셋에 기부 (defect 없이도). fail이 더 가치 있음.

## 절차 (agentic discovery)
1. **스캔** — 인자 없이 실행되면 현재 레포의 **`jobs/` 디렉토리**를 찾는다. `harbor run`은 `jobs/<job>/<trial>/agent/trajectory.json`(ATIF) + `verifier/reward.txt`(결과) + `config.json`(task/dataset/ref)에 저장. `jobs/`가 없으면 사용자에게 위치를 묻는다.
2. **현황 제시** — 각 trial을 표로: `# · task · benchmark · model · result · when`. (config.json·reward.txt 파싱.)
3. **선택** — 사용자가 자연어로 고른다 ("fail 전부", "1,2,4", "전부").
4. **매핑·확인** — 각 trajectory를 (task, harbor_ref)로 자동 매핑. **민감정보 경량 스캔**(`ghp_`/`sk-`/`API_KEY=`/`.env` 라인) → "N건 마스킹" 고지 + confirm.
5. **업로드** — `scripts/submit.mjs` 실행 (선택분을 `POST /api/contribute` batch).

## 인증
report-defect와 **같은 토큰**(`~/.delphik/token`). 없으면 https://posttrain.dev/skill-auth 안내.

## 전송 대상
`POST https://posttrain.dev/api/contribute` · `Authorization: Bearer dpk_...`
```json
{ "items": [ { "task_ref": "<harbor_task_ref>", "harbor_ref": "@2.0",
              "trajectory": { "steps": [...] }, "model_name": "...", "harness_name": "...", "scored_result": "fail" } ] }
```
응답 `201 { uploaded:[...], skipped:[{task, reason}] }`. (스펙: docs/v4/back/skill-contribute.md)

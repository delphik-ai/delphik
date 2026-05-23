---
name: report-defect
description: Report a defect in an AI benchmark TASK to Delphik. Use when, while running an eval (e.g. `harbor run`), you notice the benchmark task itself is broken — wrong gold test, impossible instruction, info leakage, env/setup bug — not your agent's mistake. Bundles task id + root-cause note + optional failing trajectory.
---

# /report-defect

벤치마크 **task 자체가 깨졌다**고 판단될 때 Delphik에 한 줄로 신고. (내 모델/하네스가 억울하게 틀린 경우 등.)

## 절차
1. **분석** — 직전 세션/run의 trajectory를 읽고, *어떤 task의 무엇이 왜* 문제인지 1차로 짚는다. `harbor run -d <dataset>@<ref>` 였다면 **`ref`(버전)** 도 읽어둔다(B1: 신고를 그 버전에 귀속).
2. **확인(confirm)** — 사용자에게 자연어로 되묻는다:
   - task · 사유(root cause) · (선택) fix 제안
   - **"이 trajectory는 공개됩니다 — 민감하면 빼고 사유만 보낼 수 있어요"** 고지(opt).
   - (Enter = 전송 / 수정 입력)
3. **전송** — 확정되면 `scripts/submit.mjs` 실행. 입력은 환경변수 또는 인자로:
   `DELPHIK_TASK_ID`, `DELPHIK_DESC`, (opt) `DELPHIK_FIX`, `DELPHIK_TRAJECTORY`(파일경로 JSON), `DELPHIK_MODEL`, `DELPHIK_HARNESS`, `DELPHIK_REF`.
4. **결과** — `{defect_id}` 받으면 안내: "신고됨 · under review · 진행상황: posttrain.dev/tasks/<task_id>".

> 원칙: 사용자는 **`/report-defect` 한 번 + Enter 한 번**이면 끝. description은 에이전트가 초안, 사용자는 confirm/수정만.

## 인증 (첫 1회)
`~/.delphik/token` 없으면: 브라우저로 **https://posttrain.dev/skill-auth** 를 열어 GitHub 로그인 → 화면의 `dpk_...` 토큰을 `~/.delphik/token` 에 저장하라고 안내. 이후 무음. (2 skill 공유.)

## 전송 대상
`POST https://posttrain.dev/api/report` · `Authorization: Bearer dpk_...`
```json
{ "task_id": "...", "description": "...", "fix_suggestion": "(opt)",
  "trajectory": { "steps": [...] }, "model_name": "(opt)", "harness_name": "(opt)", "harbor_ref": "(opt)" }
```
응답 `201 { defect_id }`. (스펙: docs/v4/back/skill.md)

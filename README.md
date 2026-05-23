# Delphik — Agent Skills

Report AI benchmark **defects** (and donate trajectories) from inside your coding agent.

```
npx skills add delphik-ai/delphik --skill report-defect [--skill contribute-trajectory]
/report-defect
```

- `report-defect` — 벤치마크 task가 깨졌을 때 1초 신고.
- `contribute-trajectory` — 자기 run trajectory를 open 데이터셋에 기부.

First run prompts a one-time GitHub login at https://posttrain.dev/skill-auth.
Format = Anthropic Agent Skills (SKILL.md). Install via Vercel Labs `skills` CLI.

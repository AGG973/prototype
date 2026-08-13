# Copy Doctor

A single-page AI web app that **diagnoses** raw marketing / property-listing copy and **rewrites** it to convert better.

Paste your copy → get an overall score, a breakdown (clarity / urgency / emotional pull + missing info), a polished rewrite, and three ready-to-send variants (social caption, formal, WhatsApp). Then give feedback ("make it punchier", "add urgency", "shorten it") and regenerate — the score animates as it improves, and a history strip shows the progression (e.g. `62 → 78 → 91`).

## Stack

- **Backend:** Node.js + Express (`server.js`), one file, serving a single static `index.html`.
- **Frontend:** vanilla JS + CSS, no framework, no build step.
- **AI:** Anthropic API via `@anthropic-ai/sdk` (model `claude-sonnet-4-5`).

## Run

```bash
npm install
export ANTHROPIC_API_KEY=sk-ant-...
node server.js
```

Then open http://localhost:3000. The textarea is pre-filled with a sample listing so you can click **Diagnose** right away.

### Config

| Env var | Default | Purpose |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | — | Required. Your Anthropic API key. |
| `PORT` | `3000` | Server port. |
| `MODEL` | `claude-sonnet-4-5` | Override the Claude model. |

## How it works

- `POST /api/diagnose` takes `{ copy }` for a first diagnosis, or `{ copy, currentRewrite, feedback }` for a refinement.
- The backend prompts Claude to return **only** a strict JSON object (`score`, `breakdown`, `rewrite`, `variants`), parses it defensively, and returns it to the browser.
- The frontend animates the score gauge, breakdown bars, and history chips in place.

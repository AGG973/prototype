# Dental Clinic Triage — Decision Support Prototype

A dashboard that takes 5 simultaneous incoming requests to a busy dental
clinic and decides, for each one: priority order, who should own it (AI /
Staff / Manager), what to do next, what to tell the customer, and why.

Confidence scores, drafted customer responses, and the AI's reasoning note
are generated **live by the Claude API**. Priority ranking and the AI /
Staff / Manager owner assignment are still decided by fixed, auditable
business rules in code — the LLM's confidence feeds into that decision, but
can never override it (a refund can't get auto-approved just because the
model feels confident about it).

## Walkthrough (30-second summary)

Five requests hit the clinic at once. For each one the app decides: **priority**
(who gets handled first), **owner** (AI / Staff / Manager), the **next action**,
the **customer response**, and **why**.

1. Each request has factor scores (urgency, financial risk, reputational risk,
   VIP status, complexity) → a fixed formula turns these into a **priority
   score**, so ranking is deterministic, not guessed.
2. Claude is called live for a **confidence score** + a drafted customer reply,
   using the clinic's knowledge base and policies as context.
3. Hard business rules sit on top of that confidence and can't be overridden:
   refund/double-charge → **always Manager**; a public-review threat →
   **always Staff**; VIP → **always Staff**. Only requests below those
   tripwires get to fall through to confidence thresholds (≥80% → AI
   auto-resolves, ≥55% → Staff confirms, else → Manager).
4. Result: pricing questions and routine bookings get **auto-handled by AI**;
   refunds and angry/VIP customers **always reach a human** — the two
   required extremes, enforced in code rather than left to the model's
   judgment.
5. If Claude is unreachable, the app falls back to an offline version of the
   same rules automatically (visible banner, same priority order) — it never
   just breaks.

See below for the full architecture and file-by-file breakdown.

## Architecture

| File | Responsibility |
|---|---|
| `data.js` | Static seed data: the 5 requests (each with raw 0-10 factor scores for urgency / financial risk / reputational risk / VIP weight / complexity), the VIP list, clinic constraints (2 staff, 3 slots left today, refunds need manager approval), and a tiny knowledge base (pricing, refund + cancellation policy). Exports for both the browser (`<script>` global) and Node (`module.exports`). |
| `engine.js` | Pure decision logic, no DOM, no network. Computes a **priority score** from the factors, and applies hard business rules on top of a confidence score (refund → always Manager; high reputational risk → always Staff; VIP → Staff) before falling back to confidence thresholds (≥80 → AI auto-resolves, ≥55 → Staff, else → Manager). Also has an offline `computeConfidence` formula, used only as a fallback if the AI is unreachable. |
| `ai-client.js` | **Server-only.** Calls the Claude API (model `claude-sonnet-5`) with the request details, the KB, and the business rules, and asks for a confidence score + drafted response + reasoning as strict JSON. The API key never leaves this process. |
| `server.js` | Tiny Node HTTP server (no dependencies — Node 18+'s built-in `fetch`). Serves the static files and one endpoint, `POST /api/triage`, which calls `ai-client.js` for all 5 requests concurrently, then applies `engine.js`'s hard rules + priority scoring in a fixed sequential pass (so slot-count updates stay deterministic regardless of which API call returns first). If a single request's AI call fails, only that request falls back to the offline formula — one flaky call can't take down the whole board. |
| `app.js` | Frontend rendering. Calls `POST /api/triage`; shows a green "Live" banner on success, or a red "AI unavailable — offline fallback" banner and switches to the local `triage()` rule engine if the server/API can't be reached. |
| `index.html` / `styles.css` | Page shell and styling (dark/light aware). |
| `.env` (gitignored, not committed) | Holds `ANTHROPIC_API_KEY` locally. Copy `.env.example` to `.env` and fill in your key. |

**Why a server at all, for a "static" prototype?** An API key can't safely
live in frontend JS — anything shipped to the browser is visible to every
visitor via view-source / the network tab. So the key stays server-side in
`ai-client.js`, and the browser only ever talks to `/api/triage` on the same
origin.

## Decision logic

**Priority score** = `urgency*0.35 + financialRisk*0.25 + reputationalRisk*0.30 + vipWeight*0.10`, scaled to 0-100. Computed in code, not by the LLM — kept deterministic and auditable.

**Confidence score** — generated live by Claude per request (with an offline formula as fallback: `100 - complexity*7 - financialRisk*4 - reputationalRisk*3`, clamped 5-98).

**Owner assignment** (in this order, enforced in code regardless of AI confidence):
1. `requiresRefund` → **Manager**, always.
2. `reputationalRisk >= 8` → **Staff**, always (AI must not respond to a public-review threat unsupervised).
3. `isVIP` → **Staff** (relationship management, even for a simple ask).
4. `confidence >= 80` → **AI**, fully automated.
5. `confidence >= 55` → **Staff** (AI drafts, human confirms).
6. else → **Manager**.

### Typical output for the 5 requests

| Rank | Request | Owner | Automated? |
|---|---|---|---|
| P1 | Double-charge complaint | Manager | No — refund rule |
| P2 | Urgent / negative-review threat | Staff | No — reputational risk |
| P3 | VIP cancellation | Staff | No — VIP relationship |
| P4 | New booking (earliest slot) | AI (usually) | **Yes, when confidence ≥ 80%** |
| P5 | Pricing inquiry | AI | **Yes — auto-answered from KB** |

Exact confidence numbers vary run to run since they're live model output —
that's expected. The priority order and the refund/reputational-risk/VIP
escalation rules do not vary; they're fixed business logic.

This covers both required extremes: fully automated workflows (booking +
pricing lookup) and a case where the AI must not act autonomously (refund /
double-charge, hard-routed to a manager regardless of how confident the
model is).

## Run it

```
cp .env.example .env
# edit .env and set ANTHROPIC_API_KEY=sk-ant-...
npm start
# then visit http://localhost:3000
```

If the API key is missing, invalid, or the request fails, the page falls
back to the offline rule-engine automatically (with a banner explaining
why) — it never just hangs or shows a blank page.

## Deploy it (public URL)

This needs a persistent Node server (not a static host), since the Claude
API key must stay server-side. `render.yaml` is set up for
[Render](https://render.com)'s free tier:

1. Push this repo to GitHub (already done if you're reading this there).
2. On Render: **New → Blueprint**, pick this repo. It reads `render.yaml`
   automatically and creates a free web service.
3. Render will prompt you to set **`ANTHROPIC_API_KEY`** in its dashboard
   (this is deliberate — the key is never in `render.yaml` or in git; you
   paste it directly into Render's environment variable UI, the same way
   `.env` works locally).
4. Deploy. Render gives you a public `https://<name>.onrender.com` URL.

Without step 3, the deployed app still works — it just falls back to the
offline rule engine with the red "AI unavailable" banner, same as running
locally without a key.

Railway and Fly.io work too, with the same idea (Node server + one env var
for the key); ask if you want configs for those instead.

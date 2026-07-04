# Dental Clinic Triage — Decision Support Prototype

A small, dependency-free dashboard that takes 5 simultaneous incoming
requests to a busy dental clinic and decides, for each one: priority order,
who should own it (AI / Staff / Manager), what to do next, what to tell the
customer, and why.

## Architecture

| File | Responsibility |
|---|---|
| `data.js` | Static seed data: the 5 requests (each with raw 0-10 factor scores for urgency / financial risk / reputational risk / VIP weight / complexity), the VIP list, clinic constraints (2 staff, 3 slots left today, refunds need manager approval), and a tiny knowledge base (pricing, refund + cancellation policy). |
| `engine.js` | Pure decision logic, no DOM. Computes a **priority score** and an **AI confidence score** from the factors, then applies hard business rules on top of confidence (refund → always Manager; high reputational risk → always Staff; VIP → Staff) before falling back to confidence thresholds (≥80 → AI auto-resolves, ≥55 → Staff, else → Manager). Also generates the action, the customer-facing response, and the reasoning string per request. |
| `app.js` | Rendering only. Reads the engine's output and draws the constraints panel + one card per request, sorted by computed priority. |
| `index.html` | Page shell, loads the three scripts above in order. |
| `styles.css` | Dashboard styling (dark/light aware). |

Nothing calls an external API — the "AI" is a deterministic scoring engine so
the demo can't fail on network/API-key issues live. The scoring logic (not
the specific request text) is what's reusable; swapping in a real LLM later
would mean replacing `computeConfidence` with an actual model call while
keeping the same hard-rule guardrails around it.

## Decision logic

**Priority score** = `urgency*0.35 + financialRisk*0.25 + reputationalRisk*0.30 + vipWeight*0.10`, scaled to 0-100.

**Confidence score** = `100 - complexity*7 - financialRisk*4 - reputationalRisk*3`, clamped 5-98. Simple, low-risk asks score high; money and reputation exposure drag it down fast, on purpose.

**Owner assignment** (in this order):
1. `requiresRefund` → **Manager**, always (business rule, ignores confidence).
2. `reputationalRisk >= 8` → **Staff**, always (AI must not respond to a public-review threat unsupervised).
3. `isVIP` → **Staff** (relationship management, even for a simple ask).
4. `confidence >= 80` → **AI**, fully automated.
5. `confidence >= 55` → **Staff** (AI drafts, human confirms).
6. else → **Manager**.

### Resulting output for the 5 requests

| Rank | Request | Owner | Confidence | Automated? |
|---|---|---|---|---|
| P1 | Double-charge complaint | Manager | 5% | No — refund rule |
| P2 | Urgent / negative-review threat | Staff | 13% | No — reputational risk |
| P3 | VIP cancellation | Staff | 42% | No — VIP relationship |
| P4 | New booking (earliest slot) | AI | 83% | **Yes — auto-booked** |
| P5 | Pricing inquiry | AI | 93% | **Yes — auto-answered from KB** |

This covers both required extremes: fully automated workflows (booking +
pricing lookup) and a case where the AI must not act autonomously (refund /
double-charge, hard-routed to a manager regardless of how confident the
model is).

## Run it

No build step, no server required:

```
open index.html   # or just double-click it / drag into a browser
```

If `file://` scripts are blocked by your browser, serve it locally instead:

```
python3 -m http.server 8000
# then visit http://localhost:8000
```

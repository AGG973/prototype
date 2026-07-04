# AI Usage Log

## 2026-07-04 — Dental clinic triage decision-support prototype

**What I asked for:**
A decision-support prototype for a busy dental clinic handling 5 simultaneous
incoming requests (VIP cancellation, new booking, double-charge complaint,
pricing inquiry, negative-review threat) under real constraints (2 staff, 3
slots left today, refunds need manager approval, a VIP list, a knowledge
base). For each request it needed to show priority order, AI confidence,
recommended owner (AI / Staff / Manager), suggested response, and reasoning
— with at least one fully automated workflow and at least one case where the
AI must escalate instead of acting on its own. I asked Claude to propose the
architecture and get my approval before building, scoped to a 20-minute
build window for a timed live challenge.

**What Claude built:**
- Proposed a 5-file static architecture up front (`data.js`, `engine.js`,
  `app.js`, `index.html`, `styles.css`) with no build step and no external
  API calls, so the demo can't fail on network/API-key issues live.
- Asked me to confirm two decisions before writing code: (1) fixed vs.
  dynamically-computed priority ordering, and (2) single-artifact vs.
  multi-file delivery.
- Built a rule-based engine that computes a 0–100 priority score and a
  confidence score from per-request risk factors (urgency, financial risk,
  reputational risk, VIP weight, complexity), then applies hard business
  rules on top (refund → always Manager; reputational risk ≥ 8 → always
  Staff; VIP → Staff) before falling back to confidence thresholds (≥80% →
  AI auto-resolves, ≥55% → Staff drafts/human confirms, else → Manager).
- Resulting ranked output: double-charge complaint (P1, Manager) →
  negative-review threat (P2, Staff) → VIP cancellation (P3, Staff) → new
  booking (P4, AI auto-books a slot) → pricing inquiry (P5, AI
  auto-answers from the knowledge base). Two fully automated workflows,
  three human-escalation cases, as required.
- Verified the page in a headless browser (screenshots, checked for
  console errors) before calling it done, rather than just asserting it
  worked.
- Committed and pushed the code to `claude/dental-clinic-triage-oe47xk`,
  and published a live, clickable artifact link for immediate testing
  without needing to clone the repo.

**What I had to correct:**
- One self-caught issue, not something I flagged: the first pass displayed
  "slots left after booking: 3" after the VIP cancellation freed a slot
  and the new booking immediately consumed it — mathematically correct
  but confusing to read at a glance. Claude caught this itself during
  verification and changed the copy to show the before → after count
  (e.g. "3 → 4 slots open", then "4 → 3 slots open") so the state change
  is legible.
- No corrections were needed from me during the session; my only inputs
  were the two upfront architecture decisions (dynamic scoring vs. fixed
  order; multi-file vs. single artifact), both of which Claude asked for
  before writing any code.

## 2026-07-04 — Made the triage engine dynamic via the Claude API

**What I asked for:**
Replace the static rule-based confidence scoring with a live call to the
Claude API, using an API key I provided directly in chat, and "store it in
`.gitignore` for security."

**What Claude built:**
- Flagged immediately, before building, that pasting a live API key into
  chat may already have exposed it (transcripts/logs can retain it), and
  recommended rotating/revoking it at console.anthropic.com after testing
  — independent of anything else done in the session.
- Corrected the framing of my request: `.gitignore` only keeps a secret out
  of *git*, not out of the *browser* — a static frontend has no safe place
  to hold an API key, since anything shipped to client JS is visible via
  view-source. Proposed the actual fix: a small Node server holding the key
  server-side, with the frontend calling that server instead of Anthropic
  directly.
- Built `server.js` (static file server + `POST /api/triage`) and
  `ai-client.js` (server-only Claude API calls), with the key read from a
  gitignored `.env` (added `.gitignore` and a committed `.env.example` with
  a placeholder). Verified `.env` never appeared in `git status` or any
  commit before pushing.
- Kept priority scoring and AI/Staff/Manager owner assignment as
  deterministic business rules in `engine.js` rather than letting the model
  decide them — the AI's confidence score feeds into the existing hard
  rules (refund → Manager, high reputational risk → Staff, VIP → Staff)
  but can't override them, so a refund still can't get auto-approved just
  because the model felt confident.
- Added a frontend fallback: a green "Live" banner when the API succeeds,
  a red "AI unavailable — offline fallback" banner with the deterministic
  rule engine taking over if the server/API can't be reached. Verified both
  states in a real headless browser.
- Ran the server end-to-end with the real key and screenshotted the
  results before considering it done, rather than just asserting it worked.

**What I had to correct:**
- Two bugs Claude caught itself during live testing, not flagged by me:
  1. On the very first real run, 2 of 5 live API calls came back with
     empty/malformed data, which would have crashed the whole batch (one
     `Promise.all` failure took down all 5 cards). Fixed by switching to
     `Promise.allSettled` with a per-request offline fallback, so one flaky
     call can no longer sink the whole board.
  2. A race condition: the "slots remaining" counter was being mutated in
     whatever order the concurrent API calls happened to resolve, not the
     fixed request order — meaning the "3 → 4 → 3 slots" narrative could
     come out wrong depending on network timing. Fixed by resolving all AI
     calls concurrently first, then applying the counter mutations in a
     strict sequential pass afterward.
  3. A live confidence dip (70–80%) on the booking request exposed a
     wording bug: the action text always said "AI books... automatically"
     even when the computed owner had fallen back to Staff. Fixed by
     branching the action text on the actual owner decision.
- Also encountered environment noise unrelated to the app itself (this
  session's background-task tracker was silently killing detached
  `node server.js` processes started with plain `&`/`nohup`, producing
  confusing exit codes) — worked around by using the harness's own
  background-task mechanism instead of shell backgrounding.
- No corrections were requested by me directly; the substantive fixes above
  were self-caught through actually running the server against the live
  API rather than just reading the code.

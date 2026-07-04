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

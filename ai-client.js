// ---------------------------------------------------------------------------
// Server-only: calls the Claude API to generate a confidence score, a
// customer-facing response, and a reasoning note for one request.
//
// IMPORTANT: this file never runs in the browser and the API key never
// leaves the server process — it's read from process.env, which server.js
// populates from the gitignored .env file.
//
// Safety note: this only asks Claude for a *confidence* score and drafted
// text. The actual owner assignment (AI / Staff / Manager) is still decided
// by the hard-coded business rules in engine.js#decideOwner, which run
// after this call and can override the AI's confidence — so a refund can
// never be auto-approved just because the model felt confident about it.
// ---------------------------------------------------------------------------

const MODEL = "claude-sonnet-5";

function buildSystemPrompt(context) {
  return `You are a triage assistant for a busy dental clinic with ${context.constraints.staffAvailable} staff on duty and ${context.constraints.slotsRemainingToday} appointment slots left today.

Hard rules you must respect when drafting your response — you do not have authority to override these, and the system will enforce them regardless of what you output:
- Refunds and duplicate-charge reversals always require manager approval. Never promise a refund yourself — only that it has been escalated for review.
- Any request where the customer threatens a negative review, or is highly upset, must be personally handled by a staff member the same day. Only acknowledge the issue and confirm a human will follow up — do not attempt to fully resolve it yourself.
- VIP patients (VIP list: ${context.vipList.join(", ")}) get first right of rebooking, handled by staff.
- Pricing questions should be answered directly from this knowledge base: ${JSON.stringify(context.knowledgeBase.pricing)}
- Refund policy: ${context.knowledgeBase.refundPolicy}
- Cancellation policy: ${context.knowledgeBase.cancellationPolicy}

For the request you're given, respond with STRICT JSON only — no markdown, no code fences, no commentary outside the object:
{"confidence": <integer 0-100, how confident you are this can be fully and safely resolved by AI alone with no human involvement>, "response": "<short, warm, customer-facing reply, 1-3 sentences>", "reasoning": "<one sentence explaining your confidence assessment>"}`;
}

function buildUserPrompt(request) {
  return `Customer: ${request.customer}
Request type: ${request.type}
Summary: ${request.summary}
Is VIP: ${request.isVIP}
Requires refund: ${request.requiresRefund}`;
}

function extractJson(text) {
  const match = text.match(/\{[\s\S]*\}/);
  return JSON.parse(match ? match[0] : text);
}

async function assessRequest(request, context) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set (check your .env file)");
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 300,
      system: buildSystemPrompt(context),
      messages: [{ role: "user", content: buildUserPrompt(request) }],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${body}`);
  }

  const data = await res.json();
  if (process.env.DEBUG_AI) console.error(`RAW for ${request.id}:`, JSON.stringify(data));
  const text = data.content?.map((b) => b.text || "").join("") || "{}";
  let parsed;
  try {
    parsed = extractJson(text);
  } catch (e) {
    throw new Error(`Could not parse Claude's response as JSON for ${request.id}: ${text}`);
  }
  if (parsed.confidence === undefined || parsed.response === undefined) {
    throw new Error(`Claude's response for ${request.id} was missing expected fields: ${text}`);
  }

  return {
    confidence: Math.max(0, Math.min(100, Math.round(Number(parsed.confidence)))),
    response: String(parsed.response ?? "").trim(),
    reasoning: String(parsed.reasoning ?? "").trim(),
  };
}

module.exports = { assessRequest };

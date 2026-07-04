// ---------------------------------------------------------------------------
// Tiny static file server + a single API endpoint that calls Claude.
// No dependencies — Node 18+ ships a global fetch, and this reads .env by
// hand so nothing needs `npm install`.
//
// This is the ONLY place the Anthropic API key is used. It is read from
// process.env (populated from the gitignored .env file below) and never
// sent to the browser.
// ---------------------------------------------------------------------------

const http = require("http");
const fs = require("fs");
const path = require("path");

const { REQUESTS, CONSTRAINTS, VIP_LIST, KNOWLEDGE_BASE } = require("./data.js");
const { computePriorityScore, computeConfidence, decideOwner, buildActionAndResponse } = require("./engine.js");
const { assessRequest } = require("./ai-client.js");

function loadEnvFile() {
  const envPath = path.join(__dirname, ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}
loadEnvFile();

const PORT = process.env.PORT || 3000;
const MIME_TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };

async function handleTriage(res) {
  try {
    const context = { constraints: CONSTRAINTS, vipList: VIP_LIST, knowledgeBase: KNOWLEDGE_BASE };

    // Fire all 5 Claude calls concurrently for speed. Promise.allSettled
    // (not .all) so one flaky/slow call can't take the whole board down —
    // that request just falls back to the local rule engine's estimate.
    const aiResults = await Promise.allSettled(REQUESTS.map((request) => assessRequest(request, context)));

    // Apply state mutations (slot counter) in a plain sequential loop, in
    // REQUESTS' fixed order — not in whatever order the network calls above
    // happened to resolve, which would make the slot count non-deterministic.
    const state = { slotsRemainingToday: CONSTRAINTS.slotsRemainingToday };
    const decisions = REQUESTS.map((request, i) => {
      const settled = aiResults[i];
      const ai =
        settled.status === "fulfilled"
          ? settled.value
          : { confidence: computeConfidence(request), response: null, reasoning: `AI call failed (${settled.reason.message}), used offline estimate.` };

      const priorityScore = computePriorityScore(request.factors);
      // Hard business rules still decide ownership — the AI's confidence
      // feeds in, but can't override refund/escalation policy.
      const ownerDecision = decideOwner(request, ai.confidence);
      const built = buildActionAndResponse(request, ownerDecision, state, KNOWLEDGE_BASE);

      return {
        ...request,
        priorityScore,
        confidence: ai.confidence,
        owner: ownerDecision.owner,
        autonomous: ownerDecision.auto,
        reasoning: `${ownerDecision.reason} — AI: "${ai.reasoning}"`,
        action: built.action,
        response: ai.response || built.response,
      };
    });

    decisions.sort((a, b) => b.priorityScore - a.priorityScore);
    decisions.forEach((d, i) => (d.priorityRank = i + 1));

    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, decisions }));
  } catch (err) {
    res.writeHead(500, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: err.message }));
  }
}

function serveStatic(req, res) {
  const urlPath = req.url.split("?")[0];
  const relPath = urlPath === "/" ? "/index.html" : urlPath;
  const filePath = path.join(__dirname, relPath);

  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404);
      return res.end("Not found");
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { "content-type": MIME_TYPES[ext] || "application/octet-stream" });
    res.end(content);
  });
}

const server = http.createServer((req, res) => {
  if (req.method === "POST" && req.url === "/api/triage") {
    return handleTriage(res);
  }
  return serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`Dental triage server running at http://localhost:${PORT}`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn("Warning: ANTHROPIC_API_KEY not set — /api/triage will return an error and the frontend will fall back to the offline rule engine.");
  }
});

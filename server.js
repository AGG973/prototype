// Copy Doctor — Express backend that asks Claude to diagnose & rewrite marketing copy.
// Run: ANTHROPIC_API_KEY=sk-... node server.js

const path = require('path');
const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');

const PORT = process.env.PORT || 3000;
const MODEL = process.env.MODEL || 'claude-sonnet-4-5';

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(express.static(__dirname));

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are Copy Doctor, an expert direct-response copywriter and conversion strategist.
You diagnose raw marketing / property-listing copy and rewrite it to convert better.

You MUST respond with ONLY a single valid JSON object and nothing else — no markdown,
no code fences, no commentary before or after. The JSON must match this exact shape:

{
  "score": <integer 0-100, overall quality of the ORIGINAL copy>,
  "breakdown": {
    "clarity": <integer 0-100>,
    "urgency": <integer 0-100>,
    "emotional_pull": <integer 0-100>,
    "missing_info": [<short strings naming concrete facts/details the copy should include but doesn't>]
  },
  "rewrite": "<a polished full rewrite of the copy — compelling, clear, ready to publish>",
  "variants": {
    "social_caption": "<punchy short social-media caption version, may use light emoji>",
    "formal": "<professional, formal version suitable for a brochure or website>",
    "whatsapp": "<friendly conversational version suitable for a WhatsApp/DM broadcast>"
  }
}

Rules:
- score reflects how good the ORIGINAL is, so an improved rewrite should earn a higher score next round.
- missing_info: 2-5 items, each a short noun phrase (e.g. "price", "square footage", "contact method").
- Keep the rewrite honest — never invent specific facts (exact prices, sizes) that weren't provided; instead use tasteful placeholders like [price] only if essential.
- Output must be parseable by JSON.parse with no trailing text.`;

function buildUserMessage({ copy, currentRewrite, feedback }) {
  if (!currentRewrite && !feedback) {
    return `Diagnose and rewrite the following marketing copy:\n\n"""\n${copy}\n"""`;
  }
  return `Here is the ORIGINAL marketing copy:\n\n"""\n${copy}\n"""\n\n` +
    `Here is the CURRENT rewrite that should be improved further:\n\n"""\n${currentRewrite || ''}\n"""\n\n` +
    `Apply this user feedback and produce a better version: "${feedback || 'make it stronger'}"\n\n` +
    `Return the same JSON shape. The new score should reflect the improved rewrite.`;
}

// Pull the first top-level JSON object out of the model's text, defensively.
function extractJson(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('No JSON object found in model response');
  }
  return JSON.parse(text.slice(start, end + 1));
}

app.post('/api/diagnose', async (req, res) => {
  try {
    const copy = (req.body && req.body.copy || '').toString().trim();
    if (!copy) return res.status(400).json({ error: 'Please provide some copy to diagnose.' });
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: 'Server missing ANTHROPIC_API_KEY.' });
    }

    const userMessage = buildUserMessage({
      copy,
      currentRewrite: req.body.currentRewrite,
      feedback: req.body.feedback,
    });

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });

    const text = response.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('');

    const result = extractJson(text);
    res.json(result);
  } catch (err) {
    console.error('Diagnose error:', err.message);
    res.status(500).json({ error: err.message || 'Something went wrong.' });
  }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.listen(PORT, () => {
  console.log(`Copy Doctor running at http://localhost:${PORT}  (model: ${MODEL})`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('WARNING: ANTHROPIC_API_KEY is not set — API calls will fail.');
  }
});

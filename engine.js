// ---------------------------------------------------------------------------
// Decision engine: pure functions, no DOM access.
// Priority and confidence are COMPUTED from the factor scores in data.js —
// not looked up from a table — so the ranking reacts if factors change.
// Owner assignment layers hard business rules on top of the computed
// confidence (e.g. "refunds always need a manager", no matter how AI feels).
// ---------------------------------------------------------------------------

const PRIORITY_WEIGHTS = { urgency: 0.35, financialRisk: 0.25, reputationalRisk: 0.30, vipWeight: 0.10 };

function computePriorityScore(factors) {
  const raw =
    factors.urgency * PRIORITY_WEIGHTS.urgency +
    factors.financialRisk * PRIORITY_WEIGHTS.financialRisk +
    factors.reputationalRisk * PRIORITY_WEIGHTS.reputationalRisk +
    factors.vipWeight * PRIORITY_WEIGHTS.vipWeight;
  return Math.round(raw * 10); // scale 0-10 factors -> 0-100 score
}

function computeConfidence(request) {
  const { complexity, financialRisk, reputationalRisk } = request.factors;
  // Simple, low-risk, low-complexity tasks -> AI is confident.
  // Money and reputational exposure erode confidence fast, by design.
  let confidence = 100 - complexity * 7 - financialRisk * 4 - reputationalRisk * 3;
  return Math.max(5, Math.min(98, Math.round(confidence)));
}

function decideOwner(request, confidence) {
  if (request.requiresRefund) {
    return { owner: "Manager", auto: false, reason: "Refunds/duplicate charges always require manager approval, regardless of AI confidence." };
  }
  if (request.factors.reputationalRisk >= 8) {
    return { owner: "Staff", auto: false, reason: "High reputational risk (public review threat) — AI must not respond autonomously; a human needs to own the relationship." };
  }
  if (request.isVIP) {
    return { owner: "Staff", auto: false, reason: "VIP relationship management is handled by staff even though the request itself is simple." };
  }
  if (confidence >= 80) {
    return { owner: "AI", auto: true, reason: `High confidence (${confidence}%) and low risk — safe for full automation.` };
  }
  if (confidence >= 55) {
    return { owner: "Staff", auto: false, reason: `Moderate confidence (${confidence}%) — AI drafts the response but a staff member should confirm before sending.` };
  }
  return { owner: "Manager", auto: false, reason: `Low confidence (${confidence}%) or elevated risk — escalated to manager.` };
}

function buildActionAndResponse(request, ownerDecision, state) {
  switch (request.type) {
    case "vip_cancellation": {
      const freedSlot = "2:00 PM";
      const before = state.slotsRemainingToday;
      state.slotsRemainingToday += 1;
      return {
        action: `Notify assigned staff member to call ${request.customer} proactively and offer first right of rebooking. Freed slot (${freedSlot}) returned to today's pool (${before} → ${state.slotsRemainingToday} slots open).`,
        response: `Hi ${request.customer.split(" ")[0]}, thanks for letting us know. As one of our valued patients, you have first right to rebook — reply with a time that works and we'll lock it in before anyone else.`,
      };
    }
    case "new_booking": {
      if (state.slotsRemainingToday <= 0) {
        return {
          action: "No slots left today — offer next available day automatically.",
          response: "The earliest slot we have today is fully booked, but I can get you in first thing tomorrow — would that work?",
        };
      }
      const before = state.slotsRemainingToday;
      state.slotsRemainingToday -= 1;
      return {
        action: `AI books the earliest remaining slot today automatically (${before} → ${state.slotsRemainingToday} slots open).`,
        response: "You're booked for the earliest available slot today. You'll receive a confirmation text shortly — see you then!",
      };
    }
    case "double_charge": {
      return {
        action: "Flag transaction for manager review; compile both charge records and route to manager queue for refund approval.",
        response: `Hi ${request.customer}, thank you for flagging this, and I'm sorry for the trouble. I've escalated it to our manager for immediate review — duplicate charges are refunded once verified, and you'll hear back from us within a few hours.`,
      };
    }
    case "pricing_inquiry": {
      const price = KNOWLEDGE_BASE.pricing.whitening;
      return {
        action: "AI answers directly from the pricing knowledge base — no human touch needed.",
        response: `Hi ${request.customer}, our whitening options are: ${price}`,
      };
    }
    case "urgent_negative_review_threat": {
      return {
        action: "Immediately escalate to an available staff member for a same-day callback; flag as retention-risk.",
        response: `Hi ${request.customer}, I'm really sorry you're dealing with this — I've flagged it as urgent and one of our team will call you back personally today to make it right.`,
      };
    }
    default:
      return { action: "Review manually.", response: "Thanks for reaching out — we'll get back to you shortly." };
  }
}

function triage(requests, constraints) {
  const state = { slotsRemainingToday: constraints.slotsRemainingToday };

  const decisions = requests.map((request) => {
    const priorityScore = computePriorityScore(request.factors);
    const confidence = computeConfidence(request);
    const ownerDecision = decideOwner(request, confidence);
    const { action, response } = buildActionAndResponse(request, ownerDecision, state);

    return {
      ...request,
      priorityScore,
      confidence,
      owner: ownerDecision.owner,
      autonomous: ownerDecision.auto,
      reasoning: ownerDecision.reason,
      action,
      response,
    };
  });

  decisions.sort((a, b) => b.priorityScore - a.priorityScore);
  decisions.forEach((d, i) => (d.priorityRank = i + 1));

  return decisions;
}

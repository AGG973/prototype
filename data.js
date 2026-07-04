// ---------------------------------------------------------------------------
// Static seed data for the dental clinic triage prototype.
// Nothing here calls a network or LLM API — this is a deterministic,
// offline-safe simulation so it can't break mid-demo.
// ---------------------------------------------------------------------------

const CONSTRAINTS = {
  staffAvailable: 2,
  slotsRemainingToday: 3,
  refundsRequireManagerApproval: true,
};

const VIP_LIST = ["Margaret Holt", "Dr. Alan Reyes", "Priya Nathan"];

const KNOWLEDGE_BASE = {
  pricing: {
    "check-up": "$85 for a standard check-up and clean.",
    "whitening": "$220 for in-chair whitening, $150 for take-home kits.",
    "filling": "$140-$210 depending on size and material.",
    default: "Our standard check-up is $85; other treatments vary by procedure — happy to give an exact quote.",
  },
  refundPolicy:
    "All refunds and duplicate-charge reversals must be approved by a manager before funds are released.",
  cancellationPolicy:
    "VIP cancellations are offered first right of rebooking into the next available slot.",
};

// Each request carries raw 0-10 factor scores the engine uses to compute
// priority + confidence. These are the only "subjective" inputs in the
// whole system — everything downstream is calculated, not hardcoded.
const REQUESTS = [
  {
    id: "R1",
    customer: "Margaret Holt",
    type: "vip_cancellation",
    summary: "VIP patient cancels their 2pm booking today.",
    isVIP: true,
    factors: { urgency: 6, financialRisk: 1, reputationalRisk: 4, vipWeight: 10, complexity: 6 },
    requiresRefund: false,
  },
  {
    id: "R2",
    customer: "New customer (web form)",
    type: "new_booking",
    summary: "Wants the earliest available appointment today.",
    isVIP: false,
    factors: { urgency: 7, financialRisk: 0, reputationalRisk: 1, vipWeight: 0, complexity: 2 },
    requiresRefund: false,
  },
  {
    id: "R3",
    customer: "Jordan Vasquez",
    type: "double_charge",
    summary: "Angry customer claims they were charged twice for a filling.",
    isVIP: false,
    factors: { urgency: 8, financialRisk: 10, reputationalRisk: 7, vipWeight: 0, complexity: 8 },
    requiresRefund: true,
  },
  {
    id: "R4",
    customer: "Sam Okafor",
    type: "pricing_inquiry",
    summary: "Simple question about whitening prices.",
    isVIP: false,
    factors: { urgency: 2, financialRisk: 0, reputationalRisk: 0, vipWeight: 0, complexity: 1 },
    requiresRefund: false,
  },
  {
    id: "R5",
    customer: "Lena Brooks",
    type: "urgent_negative_review_threat",
    summary: "Urgent issue, threatening to leave a negative review today.",
    isVIP: false,
    factors: { urgency: 9, financialRisk: 2, reputationalRisk: 10, vipWeight: 0, complexity: 7 },
    requiresRefund: false,
  },
];

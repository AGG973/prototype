// ---------------------------------------------------------------------------
// Rendering only — talks to the DOM, delegates all logic to engine.js.
// ---------------------------------------------------------------------------

function renderConstraints() {
  const el = document.getElementById("constraints");
  el.innerHTML = `
    <span>👥 ${CONSTRAINTS.staffAvailable} staff available</span>
    <span>📅 ${CONSTRAINTS.slotsRemainingToday} slots left today</span>
    <span>🔒 Refunds require manager approval</span>
    <span>⭐ VIP list loaded (${VIP_LIST.length})</span>
    <span>📚 Knowledge base loaded</span>
  `;
}

function renderRequests(decisions) {
  const el = document.getElementById("requests");
  el.innerHTML = decisions
    .map(
      (d) => `
    <div class="card">
      <div class="card-head">
        <div class="title-block">
          <div class="rank-badge">P${d.priorityRank}</div>
          <div>
            <h2>${d.customer}</h2>
            <div class="summary">${d.summary}</div>
          </div>
        </div>
        <div class="badges">
          <span class="badge owner-${d.owner}">${d.owner}${d.autonomous ? " · auto" : ""}</span>
        </div>
      </div>

      <div class="grid-row">
        <div class="label">Confidence</div>
        <div class="value">
          ${d.confidence}%
          <div class="confidence-bar-wrap"><div class="confidence-bar" style="width:${d.confidence}%"></div></div>
        </div>

        <div class="label">Action</div>
        <div class="value">${d.action}</div>

        <div class="label">Response</div>
        <div class="value"><div class="response-box">${d.response}</div></div>

        <div class="label">Reasoning</div>
        <div class="value">${d.reasoning} (priority score: ${d.priorityScore}/100)</div>
      </div>
    </div>`
    )
    .join("");
}

function main() {
  renderConstraints();
  const decisions = triage(REQUESTS, CONSTRAINTS);
  renderRequests(decisions);
}

document.addEventListener("DOMContentLoaded", main);

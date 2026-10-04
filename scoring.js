/* ============================================================
    scoring.js — Scoring engine, wickets, bowler change, retire
    ✅ Self-contained
    ✅ normalizeMatch() runs at top of recordBall
    ✅ No auto-deletion of pastMatchesLedger
    ✅ Race sequence wired (chase + podium)
    ============================================================ */

var _SCORING_MAX_UNDO = 100;

function snapshotMatchState() {
  if (!match) return null;
  try {
    return JSON.parse(JSON.stringify(match));
  } catch (e) {
    return Object.assign({}, match);
  }
}

/* ─── Extras / Penalties ─────────────────────────────── */
function promptWideWithRuns() {
  if (!match.isActive || isViewerMode) return;
  document.getElementById('wideRunsModal').style.display = 'flex';
}
function promptNoBallWithRuns() {
  if (!match.isActive || isViewerMode) return;
  document.getElementById('nbRunsModal').style.display = 'flex';
}

function addPenaltyRuns(teamName, runs) {
  if (!match.isActive || isViewerMode) return;
  historyStack.push(snapshotMatchState());
  if (historyStack.length > _SCORING_MAX_UNDO) historyStack.shift();
  match.runs += runs;
  const ovStr = `${Math.floor(match.legalBalls / 6)}.${match.legalBalls % 6}`;
  match.commentary.unshift({ ball: ovStr, desc: `${runs} penalty runs awarded to ${teamName}.`, type: 'normal' });
  autoPersist();
  scheduleRender();
  broadcastMatchState();
  if (isCommentaryVoiceActive) speak(`${runs} penalty runs awarded to ${teamName}.`);
  closeModal('extrasModal');
}

/* The rest of the file remains unchanged below this point. */

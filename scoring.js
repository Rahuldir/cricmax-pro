/* ============================================================
   scoring.js — Scoring engine, wickets, bowler change, retire
   ✅ Self-contained
   ✅ normalizeMatch() runs at top of recordBall
   ✅ No auto-deletion of pastMatchesLedger
   ✅ FOW reset between innings (fixed)
   ============================================================ */

var _SCORING_MAX_UNDO = 100;

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
  historyStack.push(JSON.parse(JSON.stringify(match)));
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

/* ═══════════════════════════════════════════════════════════
   RETIRE BATSMAN
   ═══════════════════════════════════════════════════════════ */
function openRetireModal() {
  if (!match.isActive || isViewerMode) {
    showToast('Match not active');
    return;
  }

  let modal = document.getElementById('retireModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'retireModal';
    modal.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:100000;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(4px);';
    modal.innerHTML = `
      <div style="background:linear-gradient(160deg,#0f172a,#020713);border:1px solid rgba(0,230,118,.4);border-radius:16px;padding:20px;max-width:420px;width:100%;color:#fff;box-shadow:0 20px 60px rgba(0,0,0,.8);">
        <div style="font-size:15px;font-weight:900;color:#00e676;margin-bottom:14px;letter-spacing:.6px;">🔄 RETIRE BATSMAN</div>

        <label style="font-size:11px;color:#94a3b8;font-weight:800;text-transform:uppercase;letter-spacing:1px;">Who is retiring?</label>
        <select id="retireWho" style="width:100%;margin:6px 0 14px;padding:10px;background:rgba(0,0,0,.4);border:1px solid rgba(255,255,255,.15);border-radius:8px;color:#fff;font-weight:700;"></select>

        <label style="font-size:11px;color:#94a3b8;font-weight:800;text-transform:uppercase;letter-spacing:1px;">Reason</label>
        <select id="retireReason" style="width:100%;margin:6px 0 14px;padding:10px;background:rgba(0,0,0,.4);border:1px solid rgba(255,255,255,.15);border-radius:8px;color:#fff;font-weight:700;">
          <option value="Retired Hurt">Retired Hurt (no wicket — can resume later)</option>
          <option value="Retired Out">Retired Out (counts as a wicket)</option>
        </select>

        <label style="font-size:11px;color:#94a3b8;font-weight:800;text-transform:uppercase;letter-spacing:1px;">Replacement batter</label>
        <select id="retireReplacementDD" style="width:100%;margin:6px 0 6px;padding:10px;background:rgba(0,0,0,.4);border:1px solid rgba(255,255,255,.15);border-radius:8px;color:#fff;font-weight:700;"></select>
        <input id="retireReplacementTxt" type="text" placeholder="…or type a new name" style="width:100%;padding:10px;background:rgba(0,0,0,.4);border:1px solid rgba(255,255,255,.15);border-radius:8px;color:#fff;font-weight:700;margin-bottom:16px;">

        <div style="display:flex;gap:8px;">
          <button onclick="closeModal('retireModal')" style="flex:1;padding:12px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.15);border-radius:8px;color:#94a3b8;font-weight:800;cursor:pointer;">Cancel</button>
          <button onclick="confirmRetire()" style="flex:1;padding:12px;background:linear-gradient(135deg,#009270,#00e676);border:none;border-radius:8px;color:#0a0e1a;font-weight:900;cursor:pointer;">Retire</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
  }

  const who = document.getElementById('retireWho');
  who.innerHTML = '';
  if (match.striker)    who.innerHTML += `<option value="striker">Striker: ${escapeHtml(match.striker)}</option>`;
  if (match.nonStriker) who.innerHTML += `<option value="nonStriker">Non-Striker: ${escapeHtml(match.nonStriker)}</option>`;

  const dd = document.getElementById('retireReplacementDD');
  dd.innerHTML = '<option value="">-- From squad --</option>';
  const squad = (savedTeams.find(t => t.name === match.teamBatting) || {}).squad || [];
  squad.forEach(p => {
    if (!p || p === match.striker || p === match.nonStriker) return;
    const b = match.batters[p];
    if (b && b.status && b.status !== 'dnb' && b.status !== 'batting' && b.status !== 'retired hurt') return;
    dd.innerHTML += `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`;
  });

  const txt = document.getElementById('retireReplacementTxt');
  txt.value = '';
  dd.onchange = () => { if (dd.value) txt.value = ''; };
  txt.oninput  = () => { if (txt.value) dd.value = ''; };

  modal.style.display = 'flex';
}

function confirmRetire() {
  const who    = document.getElementById('retireWho').value;
  const reason = document.getElementById('retireReason').value;
  const dd     = document.getElementById('retireReplacementDD');
  const txt    = document.getElementById('retireReplacementTxt');

  const newBatter = autoCapitalize(((txt.value || '').trim() || (dd.value || '').trim()));

  if (!newBatter) { showToast('Please pick or type a replacement batter'); return; }
  if (newBatter === match.striker || newBatter === match.nonStriker) { showToast('Replacement must be different'); return; }

  const retiringPlayer = (who === 'striker') ? match.striker : match.nonStriker;
  if (!retiringPlayer) { showToast('No batter to retire'); return; }

  historyStack.push(JSON.parse(JSON.stringify(match)));
  if (historyStack.length > _SCORING_MAX_UNDO) historyStack.shift();

  if (match.batters[retiringPlayer]) {
    match.batters[retiringPlayer].status = (reason === 'Retired Out') ? 'retired out' : 'retired hurt';
  }

  if (reason === 'Retired Out') {
    match.wickets += 1;
    match.fow.push(`${match.runs}/${match.wickets} (${retiringPlayer} retired out)`);
    triggerBanner('RETIRED OUT', `${retiringPlayer}`, 'fx-wicket');
  } else {
    triggerBanner('RETIRED HURT 🤕', `${retiringPlayer}`, 'fx-milestone');
  }

  if (!match.batters[newBatter]) {
    match.batters[newBatter] = { runs: 0, balls: 0, fours: 0, sixes: 0, dots: 0, fifties: 0, hundreds: 0, status: 'batting' };
    match.playerTeamMap[newBatter] = match.teamBattingAbbr;
    autoAddPlayerToTeam(newBatter, match.teamBatting);
  } else {
    match.batters[newBatter].status = 'batting';
  }

  if (who === 'striker') match.striker = newBatter;
  else                   match.nonStriker = newBatter;

  match.currentPartnership = { runs: 0, balls: 0, batters: [match.striker, match.nonStriker] };

  closeModal('retireModal');

  const ov = `${Math.floor(match.legalBalls / 6)}.${match.legalBalls % 6}`;
  const reasonText = (reason === 'Retired Out') ? 'retired out' : 'retired hurt';
  match.commentary.unshift({
    ball: ov,
    desc: `${escapeHtml(retiringPlayer)} ${reasonText}. ${escapeHtml(newBatter)} comes to the crease.`,
    type: 'normal'
  });

  autoPersist();
  scheduleRender();
  broadcastMatchState();
  if (isCommentaryVoiceActive) speak(`${retiringPlayer} retired. ${newBatter} comes to the crease.`);
  showToast(`✅ ${retiringPlayer} retired — ${newBatter} is in`);
}

/* ═══════════════════════════════════════════════════════════
   WICKET MODAL
   ═══════════════════════════════════════════════════════════ */
function handleWicketMethodChange(m) {
  const fg = document.getElementById('fielderGroup');
  const fl = document.getElementById('fielderLabel');
  const rg = document.getElementById('runOutRunsGroup');
  const dg = document.getElementById('wktDismissedGroup');

  if (rg) rg.style.display = (m === 'Run Out') ? 'block' : 'none';
  if (dg) dg.style.display = (m === 'Run Out' || m === 'Stumped') ? 'block' : 'none';

  if (!fg || !fl) return;
  if (m === 'Caught')      { fg.style.display = 'block'; fl.innerText = 'Catching Fielder'; }
  else if (m === 'Run Out'){ fg.style.display = 'block'; fl.innerText = 'Run-Out Fielder'; }
  else if (m === 'Stumped'){ fg.style.display = 'block'; fl.innerText = 'Wicketkeeper'; }
  else                       fg.style.display = 'none';
}

function promptWicketTypeModal() {
  if (!match.isActive || isViewerMode) return;
  if (match.wickets >= 10) { showToast('All out — 10 wickets already'); return; }

  const mSel = document.getElementById('wktMethodSelect');
  if (match.isFreeHit) {
    mSel.innerHTML = '<option value="Run Out">Run Out (Free Hit — only legal dismissal)</option>';
    mSel.disabled = true;
    handleWicketMethodChange('Run Out');
  } else {
    mSel.disabled = false;
    mSel.innerHTML = `
      <option value="Bowled">Bowled</option>
      <option value="Caught">Caught</option>
      <option value="LBW">LBW</option>
      <option value="Run Out">Run Out</option>
      <option value="Stumped">Stumped</option>
      <option value="Obstructing Field">Obstructing the Field</option>`;
    mSel.value = 'Bowled';
    handleWicketMethodChange('Bowled');
  }
  document.getElementById('fielderCustomInput').value = '';
  document.getElementById('wktNewBatsmanInput').value = '';
  const rSel = document.getElementById('runOutRunsSelect'); if (rSel) rSel.value = '0';
  const rGrp = document.getElementById('runOutRunsGroup'); if (rGrp) rGrp.style.display = 'none';
  const dSel = document.getElementById('wktDismissedBatter'); if (dSel) dSel.value = 'striker';
  populateWicketBatsmanDropdown();
  document.getElementById('wicketTypeModal').style.display = 'flex';
}

function populateWicketBatsmanDropdown() {
  const dd = document.getElementById('wktNewBatsmanSelect');
  if (!dd) return;
  dd.innerHTML = '<option value="">-- Select from squad --</option>';
  let squad = [];
  const team = savedTeams.find(t => t.name === match.teamBatting);
  if (team && team.squad) squad = team.squad.slice();

  const available = [];
  squad.forEach(p => {
    if (!p || typeof p !== 'string') return;
    const pl = p.trim();
    if (!pl || pl === match.nonStriker || pl === match.striker) return;
    const b = match.batters[pl];
    if (b && b.status && b.status !== 'dnb' && b.status !== 'batting' && b.status !== 'retired hurt') return;
    if (!available.includes(pl)) available.push(pl);
  });
  for (const k in match.batters) {
    if (match.batters[k].status === 'dnb' && k !== match.nonStriker && k !== match.striker && !available.includes(k)) {
      available.push(k);
    }
  }
  available.forEach(p => { dd.innerHTML += `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`; });

  dd.onchange = () => { if (dd.value) document.getElementById('wktNewBatsmanInput').value = ''; };
  const txtInput = document.getElementById('wktNewBatsmanInput');
  if (txtInput) txtInput.oninput = () => { dd.value = ''; };
}

function confirmWicketDelivery() {
  const methodEl = document.getElementById('wktMethodSelect');
  const method = methodEl ? methodEl.value : 'Bowled';
  let fielder = (document.getElementById('fielderCustomInput').value || '').trim();
  if (['Caught', 'Run Out', 'Stumped'].includes(method) && !fielder) {
    fielder = (method === 'Stumped') ? 'Wicketkeeper' : 'Fielder';
  }

  const typed    = (document.getElementById('wktNewBatsmanInput').value || '').trim();
  const selected = (document.getElementById('wktNewBatsmanSelect').value || '').trim();
  let newBatter = autoCapitalize(typed || selected || '');

  let runOutRuns = 0;
  if (method === 'Run Out') {
    const rSel = document.getElementById('runOutRunsSelect');
    if (rSel) runOutRuns = parseInt(rSel.value, 10) || 0;
  }

  let dismissedRole = 'striker';
  if (method === 'Run Out' || method === 'Stumped') {
    const dSel = document.getElementById('wktDismissedBatter');
    if (dSel) dismissedRole = dSel.value;
  }

  closeModal('wicketTypeModal');

  const dismissedBatterName = (dismissedRole === 'nonStriker') ? match.nonStriker : match.striker;

  recordBall(runOutRuns, null, true, "", 0, { method, fielder, dismissedRole });

  if (newBatter) {
    if (!match.batters[newBatter]) {
      autoAddPlayerToTeam(newBatter, match.teamBatting);
      match.batters[newBatter] = { runs: 0, balls: 0, fours: 0, sixes: 0, dots: 0, fifties: 0, hundreds: 0, status: 'batting' };
      match.playerTeamMap[newBatter] = match.teamBattingAbbr;
    } else match.batters[newBatter].status = 'batting';

    if (dismissedRole === 'nonStriker') match.nonStriker = newBatter;
    else                                match.striker    = newBatter;

    match.currentPartnership = { runs: 0, balls: 0, batters: [match.striker, match.nonStriker] };
    window.match = match;
    scheduleRender();
    autoPersist();
    broadcastMatchState();
    if (isCommentaryVoiceActive) speak(`New batter in: ${newBatter}.`);
  } else {
    promptNextBatterModal(dismissedBatterName);
  }
}

/* ═══════════════════════════════════════════════════════════
   NEXT BATTER / BOWLER
   ═══════════════════════════════════════════════════════════ */
function promptNextBatterModal(out) {
  const notice = document.getElementById('dismissedNotice');
  if (notice) notice.innerText = (out || 'Batter') + ' out! Next batter?';
  const s = document.getElementById('existingBatterSelect');
  if (!s) return;
  s.innerHTML = '<option value="">-- Squad --</option>';
  for (const n in match.batters) {
    if (match.batters[n].status === 'dnb' && n !== match.nonStriker && n !== match.striker) {
      s.innerHTML += `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`;
    }
  }
  const inp = document.getElementById('newBatterNameInput');
  if (inp) inp.value = '';
  const m = document.getElementById('nextBatterModal');
  if (m) m.style.display = 'flex';
}

function confirmNextBatter() {
  const t = document.getElementById('newBatterNameInput');
  const s = document.getElementById('existingBatterSelect');
  const n = autoCapitalize((t ? t.value.trim() : '') || (s ? s.value : ''));
  if (!n) return alert('Please specify next batter');

  if (t && t.value.trim()) autoAddPlayerToTeam(n, match.teamBatting);
  if (!match.batters[n]) {
    match.batters[n] = { runs: 0, balls: 0, fours: 0, sixes: 0, dots: 0, fifties: 0, hundreds: 0, status: "batting" };
    match.playerTeamMap[n] = match.teamBattingAbbr;
  } else match.batters[n].status = 'batting';

  const strikerOut    = !match.striker    || !match.batters[match.striker]    || match.batters[match.striker].status    !== 'batting';
  const nonStrikerOut = !match.nonStriker || !match.batters[match.nonStriker] || match.batters[match.nonStriker].status !== 'batting';

  if (strikerOut && !nonStrikerOut)      match.striker = n;
  else if (!strikerOut && nonStrikerOut) match.nonStriker = n;
  else                                    match.striker = n;

  closeModal('nextBatterModal');
  match.currentPartnership = { runs: 0, balls: 0, batters: [match.striker, match.nonStriker] };
  scheduleRender();
  autoPersist();
  broadcastMatchState();
  if (isCommentaryVoiceActive) speak('New batter in: ' + n + '.');
}

function promptNextBowlerModal() {
  if (!match.isActive || isViewerMode) return;
  const s = document.getElementById('existingBowlerSelect');
  if (!s) { console.warn('[CricMax] existingBowlerSelect not found'); return; }
  s.innerHTML = '<option value="">-- Squad --</option>';

  let anyAvailable = false;
  for (const n in match.bowlers) {
    if (n === match.previousBowler) continue;
    if (matchConfig.maxOversPerBowler > 0) {
      const bowled = Math.floor((match.bowlers[n].balls || 0) / 6);
      if (bowled >= matchConfig.maxOversPerBowler) continue;
    }
    s.innerHTML += `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`;
    anyAvailable = true;
  }
  if (!anyAvailable) {
    s.innerHTML = '<option value="">-- No other bowlers — type below --</option>';
    showToast('⚠️ No other bowlers in squad — type a new one');
  }

  const inp = document.getElementById('newBowlerNameInput');
  if (inp) inp.value = '';
  const m = document.getElementById('bowlerModal');
  if (m) m.style.display = 'flex';
}

function confirmNextBowler() {
  const t = document.getElementById('newBowlerNameInput');
  const s = document.getElementById('existingBowlerSelect');
  const n = autoCapitalize((t ? t.value.trim() : '') || (s ? s.value : ''));
  if (!n) return alert('Please specify next bowler');

  if (n === match.previousBowler) {
    if (!confirm(`${n} bowled the previous over.\n\nCricket rules do not allow consecutive overs.\n\nAllow anyway?`)) return;
  }

  if (t && t.value.trim()) autoAddPlayerToTeam(n, match.teamBowling);
  if (!match.bowlers[n]) {
    match.bowlers[n] = { balls: 0, maidens: 0, runs: 0, wickets: 0, dots: 0, threeW: 0, fiveW: 0 };
    match.playerTeamMap[n] = match.teamBowlingAbbr;
  }
  if (matchConfig.maxOversPerBowler > 0) {
    const bowled = Math.floor(match.bowlers[n].balls / 6);
    if (bowled >= matchConfig.maxOversPerBowler) {
      if (!confirm(`${n} has already bowled ${bowled} overs (max ${matchConfig.maxOversPerBowler}). Allow anyway?`)) return;
    }
  }
  match.currentBowler = n;
  closeModal('bowlerModal');
  scheduleRender();
  autoPersist();
  broadcastMatchState();
  if (isCommentaryVoiceActive) speak('Bowling change. ' + n + ' comes into the attack.');
  showToast(`🎳 ${n} into the attack`);
}

function changeBowlerMidOver() {
  if (!match.isActive || isViewerMode) return;
  if (!confirm('Change bowler mid-over?\n\nThe current over will continue with the new bowler.')) return;
  promptNextBowlerModal();
}

let _bowlerPromptToken = 0;
function forceBowlerChangePrompt(attempt) {
  attempt = attempt || 0;
  const myToken = ++_bowlerPromptToken;
  const delay = (attempt === 0) ? 700 : 400;

  setTimeout(function () {
    if (myToken !== _bowlerPromptToken) return;
    if (!match.isActive || isViewerMode) return;

    const wk  = document.getElementById('wicketTypeModal');
    const nb  = document.getElementById('nextBatterModal');
    const rtr = document.getElementById('retireModal');
    const wkOpen  = wk  && wk.style.display  === 'flex';
    const nbOpen  = nb  && nb.style.display  === 'flex';
    const rtrOpen = rtr && rtr.style.display === 'flex';

    if (wkOpen || nbOpen || rtrOpen) {
      if (attempt < 12) forceBowlerChangePrompt(attempt + 1);
      return;
    }
    const bm = document.getElementById('bowlerModal');
    if (bm && bm.style.display === 'flex') return;

    console.info('[CricMax] Over ended — prompting next bowler (previous:', match.previousBowler, ')');
    promptNextBowlerModal();
  }, delay);
}

/* ═══════════════════════════════════════════════════════════
   COMMENTARY PHRASES
   ═══════════════════════════════════════════════════════════ */
function pickFresh(key, arr) {
  if (!usedPhrases[key]) usedPhrases[key] = [];
  const used = usedPhrases[key];
  let av = arr.filter(p => !used.includes(p));
  if (av.length === 0) { used.length = 0; av = arr; }
  const c = av[Math.floor(Math.random() * av.length)];
  used.push(c);
  if (used.length > Math.min(6, arr.length - 1)) used.shift();
  return c;
}
function fill(t, v) {
  return t.replace(/{STRIKER}/g, v.striker || '')
          .replace(/{BOWLER}/g,  v.bowler  || '')
          .replace(/{REGION}/g,  v.region  || 'the field')
          .replace(/{DIST}/g,    v.dist    || '');
}

const P = {

  /* ═══════════════════════════════════════════════════════════
     DOT BALLS — 30 variations
     ═══════════════════════════════════════════════════════════ */
  DOT: [
    "{STRIKER} defends into {REGION}, no run.",
    "Good length from {BOWLER}, solidly defended.",
    "Beaten! Past the outside edge!",
    "Dot ball, pushed to {REGION}.",
    "Fielded at {REGION}, no run.",
    "Straight to hand at {REGION}.",
    "Solid forward defence by {STRIKER}.",
    "Tight line from {BOWLER}, no room.",
    "Left alone, outside off.",
    "Defended off the back foot.",
    "Good bowling, dot ball.",
    "{BOWLER} keeps it tight, no run.",
    "Played into the ground, fielded.",
    "Beaten by the away-swinger!",
    "Blocked back down the pitch.",
    "Squeezed out to {REGION}, no run.",
    "Right in the corridor, {STRIKER} leaves it.",
    "Beautiful shape on that one from {BOWLER}!",
    "Kept low, {STRIKER} adjusts well.",
    "Rapped on the pads, but going down leg.",
    "Extra bounce, {STRIKER} does well to drop his hands.",
    "Bowled full, driven to {REGION}, no run.",
    "That one held up off the surface!",
    "Good pressure from {BOWLER}.",
    "Dot ball. Building the pressure here.",
    "Played with soft hands, no run.",
    "Fizzed past the stumps! So close!",
    "Big shout for LBW... not out, sliding down.",
    "Safely negotiated by {STRIKER}.",
    "Well fielded at {REGION}, keeps it to nothing."
  ],

  /* ═══════════════════════════════════════════════════════════
     SINGLES — 15 variations
     ═══════════════════════════════════════════════════════════ */
  ONE: [
    "Nudged into {REGION}, quick single.",
    "Worked off the pads, one run.",
    "Pushed down to {REGION}, single taken.",
    "Driven into {REGION} for one.",
    "Tucked off the hip for a single.",
    "Soft hands into {REGION}, one run.",
    "Gentle push and they scamper through.",
    "Single to {REGION}, good running.",
    "Dabbed into the gap, one run.",
    "Rotates the strike with a single.",
    "Smart cricket, just a single.",
    "Pushed to cover, easy single.",
    "One run. Keeps the scoreboard moving.",
    "Quick single, direct hit would have been close!",
    "Deflected to {REGION}, single taken."
  ],

  /* ═══════════════════════════════════════════════════════════
     TWOS — 12 variations
     ═══════════════════════════════════════════════════════════ */
  TWO: [
    "Placed into {REGION}, they come back for two.",
    "Flicked away, two runs.",
    "Couple taken, good running.",
    "Two runs, well placed into {REGION}.",
    "Driven into the gap, back for the second.",
    "Excellent running, brace taken.",
    "Two runs, fielder cuts it off.",
    "Pushed to {REGION}, comfortable two.",
    "Two runs. Great understanding between the batsmen.",
    "Well run, two runs to the total.",
    "Two more, kept the scoreboard ticking.",
    "Two runs. The fielder's throw was wide."
  ],

  /* ═══════════════════════════════════════════════════════════
     THREES — 8 variations
     ═══════════════════════════════════════════════════════════ */
  THREE: [
    "Drilled wide of {REGION}, three runs!",
    "Timed beautifully, three runs taken.",
    "Three runs! Excellent running!",
    "Split the field, three runs.",
    "Deep into the gap, three runs taken.",
    "They run hard, three runs!",
    "Three runs. Top-class running between the wickets!",
    "Three! The fielder gave chase but couldn't stop it."
  ],

  /* ═══════════════════════════════════════════════════════════
     FOURS — 25 variations
     ═══════════════════════════════════════════════════════════ */
  FOUR: [
    "FOUR! Cracking shot through {REGION}!",
    "FOUR! Races past the rope at {REGION}!",
    "FOUR! Pure timing through {REGION}!",
    "FOUR! Finds the fence at {REGION}!",
    "FOUR! Caressed through {REGION}!",
    "FOUR! Tracer bullet to {REGION}!",
    "FOUR! {STRIKER} pierces the gap at {REGION}!",
    "FOUR! That is a textbook stroke!",
    "FOUR! No chance for the fielder!",
    "FOUR! Races to the boundary!",
    "FOUR! {STRIKER} makes it look easy!",
    "FOUR! Threaded through {REGION}!",
    "FOUR! What a shot! Beautifully played!",
    "FOUR! Pierced the infield and away!",
    "FOUR! Timing, placement, class!",
    "FOUR! {STRIKER} is in sublime touch!",
    "FOUR! That is a brilliant cover drive!",
    "FOUR! Nothing wrong with that delivery!",
    "FOUR! Gorgeous stroke through {REGION}!",
    "FOUR! That'll hurt the bowler's figures!",
    "FOUR! Runs hard, hits hard, FOUR!",
    "FOUR! {BOWLER} will feel unlucky there!",
    "FOUR! That's as good as it gets!",
    "FOUR! Mid-off had no chance!",
    "FOUR! Exquisite timing from {STRIKER}!"
  ],

  /* ═══════════════════════════════════════════════════════════
     SIXES — 25 variations
     ═══════════════════════════════════════════════════════════ */
  SIX: [
    "SIX! {STRIKER} goes big over {REGION} {DIST}!",
    "SIX! Into the stands over {REGION}!",
    "SIX! Massive hit! {DIST}",
    "SIX! Out of the ground! {DIST}",
    "SIX! Enormous over {REGION}!",
    "SIX! Clean strike by {STRIKER}!",
    "SIX! That is huge!",
    "SIX! Deposited over {REGION}!",
    "SIX! Flat and fast over {REGION}!",
    "SIX! {STRIKER} launches it! {DIST}",
    "SIX! Picked the length early!",
    "SIX! What a shot! Into the crowd!",
    "SIX! That is a monster hit! {DIST}",
    "SIX! Right out of the screws!",
    "SIX! Take that, {BOWLER}!",
    "SIX! The crowd is on their feet!",
    "SIX! Absolutely launched over {REGION}!",
    "SIX! That's gone into orbit! {DIST}",
    "SIX! Sheer power from {STRIKER}!",
    "SIX! Placed perfectly, gone for SIX!",
    "SIX! What a strike! {DIST}",
    "SIX! That's the shot of the day!",
    "SIX! Effortless from {STRIKER}!",
    "SIX! Maximum! The crowd goes wild!",
    "SIX! That is an enormous blow! {DIST}"
  ],

  /* ═══════════════════════════════════════════════════════════
     WICKET — BOWLED — 10 variations
     ═══════════════════════════════════════════════════════════ */
  WB: [
    "BOWLED! {BOWLER} through the gate! {STRIKER} gone!",
    "CLEANED HIM UP! {BOWLER} finds the timber!",
    "BOWLED! What a delivery from {BOWLER}!",
    "BOWLED HIM! {STRIKER} has to go!",
    "TIMBER! {BOWLER} strikes!",
    "BOWLED! Right through the defence!",
    "BOWLED! Unplayable delivery from {BOWLER}!",
    "BOWLED! {STRIKER} played all around it!",
    "BOWLED! The stumps are in a mess!",
    "THROUGH THE GATE! {BOWLER} is pumped!"
  ],

  /* ═══════════════════════════════════════════════════════════
     WICKET — CAUGHT — 12 variations
     ═══════════════════════════════════════════════════════════ */
  WC: [
    "CAUGHT! {STRIKER} has holed out!",
    "TAKEN! Great catch!",
    "CAUGHT! Straight down the throat!",
    "CAUGHT! {BOWLER} gets his man!",
    "TAKEN! Safe hands in the deep!",
    "CAUGHT! Superb catch by the fielder!",
    "CAUGHT! {STRIKER} couldn't clear the fielder!",
    "TAKEN! What a grab!",
    "CAUGHT! Right at the boundary rope!",
    "CAUGHT! Simple catch, well taken!",
    "CAUGHT! The pressure told!",
    "OUT! Caught! {STRIKER} goes aerial and pays the price!"
  ],

  /* ═══════════════════════════════════════════════════════════
     WICKET — LBW — 8 variations
     ═══════════════════════════════════════════════════════════ */
  WL: [
    "LBW! {BOWLER} traps {STRIKER} plumb!",
    "LBW! Given! Dead in front!",
    "LBW! The finger goes up!",
    "LBW! {STRIKER} has to go!",
    "LBW! That looked absolutely plumb!",
    "LBW! Hit on the knee roll, out!",
    "LBW! {BOWLER} wins the battle!",
    "LBW! No doubt about that one!"
  ],

  /* ═══════════════════════════════════════════════════════════
     WICKET — RUN OUT — 8 variations
     ═══════════════════════════════════════════════════════════ */
  WR: [
    "RUN OUT! Direct hit!",
    "RUN OUT! Brilliant work in the field!",
    "RUN OUT! Poor running between the wickets!",
    "RUN OUT! {STRIKER} is short of his ground!",
    "RUN OUT! What a throw!",
    "RUN OUT! Big mix-up in the middle!",
    "RUN OUT! The fielder was lightning quick!",
    "RUN OUT! Communication breakdown, and it costs them!"
  ],

  /* ═══════════════════════════════════════════════════════════
     WICKET — STUMPED — 6 variations
     ═══════════════════════════════════════════════════════════ */
  WS: [
    "STUMPED! Lightning glovework!",
    "STUMPED! Out of his crease!",
    "STUMPED! The keeper does the rest!",
    "STUMPED! {STRIKER} is well short!",
    "STUMPED! Brilliant awareness by the keeper!",
    "STUMPED! Down the track and beaten!"
  ],

  /* ═══════════════════════════════════════════════════════════
     WIDES — 10 variations
     ═══════════════════════════════════════════════════════════ */
  WD: [
    "Wide! {BOWLER} strays down the side.",
    "That's a wide, extra run.",
    "Wide called by the umpire.",
    "Down the leg side, wide.",
    "Too wide outside off, wide called.",
    "Wide! Unnecessary extra from {BOWLER}!",
    "Sprayed down the leg, wide signalled.",
    "That's a wide, poor line from {BOWLER}.",
    "Wide! {BOWLER} will be disappointed with that.",
    "Wide. That cost them a run."
  ],

  /* ═══════════════════════════════════════════════════════════
     NO BALLS — 10 variations
     ═══════════════════════════════════════════════════════════ */
  NB: [
    "No ball! {BOWLER} overstepped!",
    "Front foot no ball!",
    "No ball called, free hit coming up!",
    "Overstepped the line, no ball!",
    "No ball! Extra run, free hit next!",
    "No ball! {BOWLER} has overstepped the line!",
    "Called a no ball! That's a free hit!",
    "No ball! Costly error by {BOWLER}!",
    "Front foot over the line, no ball!",
    "No ball! And {STRIKER} gets a free hit!"
  ],

  /* ═══════════════════════════════════════════════════════════
     LEG BYES — 8 variations
     ═══════════════════════════════════════════════════════════ */
  LB: [
    "Leg bye! Off the pad, they steal a run.",
    "Leg bye taken, off the thigh pad.",
    "Off the pads, leg bye signalled.",
    "Leg bye, ball rolls fine.",
    "Leg bye! Good running from the batsmen.",
    "Leg bye. Not off the bat, but they take a run.",
    "Deflected off the pad, leg bye.",
    "Leg bye! {STRIKER} was beaten but they run anyway."
  ],

  /* ═══════════════════════════════════════════════════════════
     MILESTONE — FIFTY (called separately from recordBall)
     ═══════════════════════════════════════════════════════════ */
  FIFTY: [
    "FIFTY! Well played, {STRIKER}!",
    "FIFTY up! Superb knock by {STRIKER}!",
    "FIFTY! A fantastic half-century from {STRIKER}!",
    "FIFTY! Deserved milestone for {STRIKER}!",
    "FIFTY! {STRIKER} reaches the landmark!",
    "FIFTY! Classy innings from {STRIKER}!",
    "FIFTY! Take a bow, {STRIKER}!",
    "FIFTY! {STRIKER} raises the bat!"
  ],

  /* ═══════════════════════════════════════════════════════════
     MILESTONE — CENTURY
     ═══════════════════════════════════════════════════════════ */
  CENTURY: [
    "CENTURY! Magnificent hundred for {STRIKER}!",
    "CENTURY! Take a bow, {STRIKER}, what an innings!",
    "CENTURY! A truly special knock by {STRIKER}!",
    "CENTURY! Brilliant, brilliant hundred!",
    "CENTURY! {STRIKER} reaches three figures!",
    "CENTURY! The crowd rises for {STRIKER}!",
    "CENTURY! A masterclass from {STRIKER}!",
    "CENTURY! What a moment for {STRIKER}!"
  ],

  /* ═══════════════════════════════════════════════════════════
     MILESTONE — TEAM 50 / 100
     ═══════════════════════════════════════════════════════════ */
  TEAM_50: [
    "Fifty up for {TEAM}!",
    "The team fifty comes up for {TEAM}.",
    "{TEAM} reach 50 — good platform being built.",
    "Half century on the board for {TEAM}!"
  ],

  TEAM_100: [
    "Hundred up for {TEAM}!",
    "{TEAM} reach 100 — well played!",
    "The 100 comes up for {TEAM}!",
    "{TEAM} bring up the three-figure mark!"
  ],

  /* ═══════════════════════════════════════════════════════════
     MILESTONE — FIVE-WICKET HAUL / HAT-TRICK
     ═══════════════════════════════════════════════════════════ */
  FIVE_FOR: [
    "FIVE-FOR! {BOWLER} has been outstanding!",
    "FIVE WICKETS! A brilliant spell from {BOWLER}!",
    "{BOWLER} takes his fifth! Superb bowling!",
    "Five-for for {BOWLER}! What a performance!"
  ]
};

function genComm(runs, extra, isWkt, region, distance, dd) {
  const s = match.striker || 'Batter';
  const b = match.currentBowler || 'Bowler';
  const dir = region || 'the field';
  const d = distance > 0 ? `[${distance}m]` : '';
  const v = { striker: s, bowler: b, region: dir, dist: d };

  if (extra === 'WD') return fill(pickFresh('WD', P.WD), v);
  if (extra === 'NB') return fill(pickFresh('NB', P.NB), v);
  if (extra === 'B')  return "Bye taken.";
  if (extra === 'LB') return fill(pickFresh('LB', P.LB), v);
  if (isWkt) {
    if (!dd || !dd.method) return `OUT! ${s} dismissed!`;
    if (dd.method === 'Bowled')  return fill(pickFresh('WB', P.WB), v);
    if (dd.method === 'Caught')  return fill(pickFresh('WC', P.WC), v);
    if (dd.method === 'LBW')     return fill(pickFresh('WL', P.WL), v);
    if (dd.method === 'Run Out') return fill(pickFresh('WR', P.WR), v);
    if (dd.method === 'Stumped') return fill(pickFresh('WS', P.WS), v);
    return `OUT! ${s} dismissed!`;
  }
  if (runs === 0) return fill(pickFresh('D', P.DOT), v);
  if (runs === 1) return fill(pickFresh('1', P.ONE), v);
  if (runs === 2) return fill(pickFresh('2', P.TWO), v);
  if (runs === 3) return fill(pickFresh('3', P.THREE), v);
  if (runs === 4) return fill(pickFresh('4', P.FOUR), v);
  if (runs === 6) return fill(pickFresh('6', P.SIX), v);
  return `${runs} run(s).`;
}

/* ═══════════════════════════════════════════════════════════
   BONUS — Context-aware commentary wrapper
   Adds chase / powerplay / death-over flavor on top of genComm
   ═══════════════════════════════════════════════════════════ */
var __flavorLast = {};
function __pickFlavor(arr){
  if (!arr || !arr.length) return '';
  var choice, tries = 0;
  do { choice = arr[Math.floor(Math.random()*arr.length)]; tries++; }
  while (choice === __flavorLast._ && tries < 6);
  __flavorLast._ = choice;
  return choice;
}

function genCommContextual(runs, extra, isWkt, region, distance, dd) {
  const base = genComm(runs, extra, isWkt, region, distance, dd);

  /* Only add flavor on boundaries/dots/wickets — 35% chance */
  const addFlavor = (runs === 4 || runs === 6 || runs === 0 || isWkt) && Math.random() < 0.35;
  if (!addFlavor) return base;

  const innings   = match.innings || 1;
  const ballsLeft = Math.max(0, (match.totalOvers || 20) * 6 - match.legalBalls);
  const oversLeft = ballsLeft / 6;
  const needed    = match.target > 0 ? Math.max(0, match.target - match.runs) : 0;
  const rrr       = ballsLeft > 0 && needed > 0 ? (needed / ballsLeft) * 6 : 0;
  const overNum   = Math.ceil(match.legalBalls / 6);
  const isPP      = overNum <= 6;
  const isDeath   = oversLeft <= 4;

  var flavor = '';

  /* Chase context — 2nd innings */
  if (innings === 2 && needed > 0) {
    if (needed <= 5 && needed > 0) {
      flavor = __pickFlavor([
        `Just ${needed} needed now!`,
        `${needed} away from victory!`,
        `Almost there — ${needed} to win!`
      ]);
    } else if (rrr > 12 && needed > 10) {
      flavor = __pickFlavor([
        `The required rate is climbing — ${needed} needed off ${ballsLeft}.`,
        `${needed} to win off ${ballsLeft} balls. It's getting tight!`,
        `Pressure building. ${needed} required, ${ballsLeft} balls left.`,
        `The asking rate is ${rrr.toFixed(1)}. ${needed} needed.`
      ]);
    } else if (rrr < 6 && needed < 30) {
      flavor = __pickFlavor([
        `${needed} needed off ${ballsLeft}. Comfortable from here.`,
        `Chasing side is well ahead of the rate.`,
        `This looks done and dusted unless something dramatic happens.`
      ]);
    }
  }

  /* Powerplay context */
  if (isPP && !flavor) {
    if (runs === 4 || runs === 6) {
      flavor = __pickFlavor([
        `The powerplay is delivering!`,
        `Making the most of the fielding restrictions!`,
        `That's the platform being built.`
      ]);
    } else if (isWkt) {
      flavor = __pickFlavor([
        `Crucial breakthrough in the powerplay!`,
        `Big wicket inside the fielding restrictions!`
      ]);
    }
  }

  /* Death overs context */
  if (isDeath && !flavor) {
    if (runs === 6) {
      flavor = __pickFlavor([
        `That's a massive hit in the death overs!`,
        `Death bowling under pressure — that's gone!`
      ]);
    } else if (isWkt) {
      flavor = __pickFlavor([
        `Huge wicket in the death!`,
        `Death overs — every wicket is gold!`
      ]);
    }
  }

  return flavor ? `${base} ${flavor}` : base;
}

/* ═══════════════════════════════════════════════════════════
   RECORD BALL — the scoring engine
   ⚡ normalizeMatch() runs first
   ═══════════════════════════════════════════════════════════ */
function recordBall(runs = 0, extra = null, isWicket = false, region = "", distance = 0, dd = null) {
  if (!match.isActive || isViewerMode) return;

  /* ⚡ Self-heal missing arrays before scoring */
  if (typeof normalizeMatch === 'function') normalizeMatch(match);

  /* Safety defaults */
  if (!match.striker)       match.striker       = 'Striker';
  if (!match.nonStriker)    match.nonStriker    = 'Non-Striker';
  if (!match.currentBowler) match.currentBowler = 'Bowler';
  if (typeof match._currentOverRuns !== 'number') match._currentOverRuns = 0;

  [match.striker, match.nonStriker].forEach(p => {
    if (!match.batters[p]) {
      match.batters[p] = { runs: 0, balls: 0, fours: 0, sixes: 0, dots: 0, fifties: 0, hundreds: 0, status: 'batting' };
      match.playerTeamMap[p] = match.teamBattingAbbr;
    }
  });
  if (!match.bowlers[match.currentBowler]) {
    match.bowlers[match.currentBowler] = { balls: 0, maidens: 0, runs: 0, wickets: 0, dots: 0, threeW: 0, fiveW: 0 };
    match.playerTeamMap[match.currentBowler] = match.teamBowlingAbbr;
  }

  historyStack.push(JSON.parse(JSON.stringify(match)));
  if (historyStack.length > _SCORING_MAX_UNDO) historyStack.shift();

  const striker  = match.batters[match.striker];
  const bowler   = match.bowlers[match.currentBowler];
  const prevMatchRuns = match.runs;
  const prevRuns      = striker.runs;
  const prevTeam      = match.runs;
  const wasFH         = match.isFreeHit;

  let dismissedKey = 'striker';
  if (isWicket && dd && dd.dismissedRole === 'nonStriker') dismissedKey = 'nonStriker';
  const dismissedName  = match[dismissedKey];
  const dismissedStats = match.batters[dismissedName];

  let tag = runs.toString();
const desc = (typeof genCommContextual === 'function')
  ? genCommContextual(runs, extra, isWicket, region, distance, dd)
  : genComm(runs, extra, isWicket, region, distance, dd);
  if (extra !== 'WD' && extra !== 'NB') {
    if (!match.currentPartnership) match.currentPartnership = { runs: 0, balls: 0, batters: [match.striker, match.nonStriker] };
    match.currentPartnership.balls = (match.currentPartnership.balls || 0) + 1;
  }

  const capturedAngle = (typeof window._tempExactAngle === 'number') ? window._tempExactAngle : null;
  window._tempExactAngle = undefined;

  const zoneIndex = region
    ? ["Third Man","Point","Cover","Mid-off","Mid-on","Mid-wicket","Square Leg","Fine Leg"].indexOf(region)
    : -1;
  const overNum = Math.floor(match.legalBalls / 6) + 1;
  const bowlerType = detectBowlerType(match.currentBowler);

  const shotPayload = {
    inns: match.innings, over: overNum, ball: match.legalBalls + 1,
    batter: (dismissedKey === 'nonStriker') ? dismissedName : match.striker,
    bowler: match.currentBowler,
    runs: runs || 0, zone: region || '', angle: capturedAngle, zoneIndex,
    isWicket: !!isWicket, isFour: runs === 4, isSix: runs === 6,
    isBoundary: runs === 4 || runs === 6, isDot: runs === 0 && !extra,
    extra: extra || null, bowlerType, distance: distance || 0,
    ballRandom: Math.random()
  };
  match.shotLog.push(shotPayload);

  /* ---- Process delivery ---- */
  if (extra === 'WD') {
    const wideBase = (typeof matchConfig.wideRuns === 'number') ? matchConfig.wideRuns : 1;
    match.runs += wideBase + runs;
    bowler.runs += wideBase + runs;
    tag = (wideBase + runs) > 1 ? `${wideBase + runs}Wd` : `${wideBase}Wd`;
    if (matchConfig.wideCountsAsBall) {
      match.legalBalls += 1; bowler.balls += 1;
      if (!isWicket) striker.balls += 1;
    }
  } else if (extra === 'NB') {
    const nbBase = (typeof matchConfig.nbRuns === 'number') ? matchConfig.nbRuns : 1;
    match.runs += nbBase + runs;
    bowler.runs += nbBase + runs;
    striker.balls += 1;
    if (runs > 0) {
      striker.runs += runs;
      if (runs === 4) striker.fours += 1;
      if (runs === 6) striker.sixes += 1;
    }
    if (match.currentPartnership) match.currentPartnership.balls += 1;
    tag = (nbBase + runs) > 1 ? `${nbBase + runs}Nb` : `${nbBase}Nb`;
    if (matchConfig.autoFreeHitOnNB) match.isFreeHit = true;
  } else if (extra === 'B') {
    match.runs += runs; match.legalBalls += 1; bowler.balls += 1; striker.balls += 1;
    tag = `${runs}B`;
    if (runs % 2 !== 0) swapStrikers();
  } else if (extra === 'LB') {
    match.runs += runs; match.legalBalls += 1; bowler.balls += 1; striker.balls += 1;
    tag = `${runs}Lb`;
    if (runs % 2 !== 0) swapStrikers();
  } else if (isWicket) {
    match.wickets += 1;
    match.legalBalls += 1;
    bowler.balls += 1;
    if (dismissedStats) dismissedStats.balls += 1;
    if (runs > 0) {
      striker.runs += runs; match.runs += runs;
      if (runs === 4) striker.fours += 1;
      if (runs === 6) striker.sixes += 1;
    }
    const method = dd ? dd.method : 'Bowled';
    if (method !== 'Run Out') {
      bowler.wickets += 1;
      if (bowler.wickets === 3) {
        bowler.threeW = (bowler.threeW || 0) + 1;
        setTimeout(() => triggerBanner('3-WICKET HAUL! 🎩', `${match.currentBowler}`, 'fx-milestone'), 800);
      }
      if (bowler.wickets === 5) {
        bowler.fiveW = (bowler.fiveW || 0) + 1;
        setTimeout(() => triggerBanner('FIVE-FOR! 🔥', `${match.currentBowler} 5/${bowler.runs}`, 'fx-milestone'), 800);
      }
    }
    if (dismissedStats) {
      dismissedStats.status = (method === 'Bowled')
        ? `b ${match.currentBowler}`
        : `${method.toLowerCase()} b ${match.currentBowler}`;
    }
    tag = 'W';
    if (dd && ['Caught','Run Out','Stumped'].includes(dd.method)) {
      const fn = dd.fielder || 'Fielder';
      if (!match.fielding[fn]) match.fielding[fn] = { catches: 0, stumpings: 0, runOuts: 0 };
      if (dd.method === 'Caught')                                                        match.fielding[fn].catches   += 1;
      else if (dd.method === 'Stumped' && matchConfig.autoDetectStumpings)               match.fielding[fn].stumpings += 1;
      else if (dd.method === 'Run Out')                                                  match.fielding[fn].runOuts   += 1;
    }
    match.fow.push(`${match.runs}/${match.wickets} (${dismissedName})`);
    triggerBanner('WICKET! 🚨', `${dismissedName} out`, 'fx-wicket');
    match.partnerRuns.push({ ...match.currentPartnership });
    match.currentPartnership = { runs: 0, balls: 0, batters: [] };
  } else {
    match.runs += runs; match.legalBalls += 1; bowler.balls += 1;
    bowler.runs += runs; striker.balls += 1; striker.runs += runs;
    if (runs === 0) { striker.dots = (striker.dots || 0) + 1; bowler.dots = (bowler.dots || 0) + 1; }
    if (runs === 4) striker.fours += 1;
    if (runs === 6) striker.sixes += 1;
    if (runs % 2 !== 0) swapStrikers();
    if (prevRuns < 50 && striker.runs >= 50) {
      striker.fifties += 1;
      triggerBanner('HALF CENTURY! 🌟', `${match.striker} 50!`, 'fx-milestone');
    } else if (prevRuns < 100 && striker.runs >= 100) {
      striker.hundreds += 1;
      triggerBanner('CENTURY! 👑', `${match.striker} 100!`, 'fx-milestone');
    }
  }

  if (wasFH) match.isFreeHit = false;
  if (matchConfig.forceFreeHit) match.isFreeHit = true;

  match._currentOverRuns += (match.runs - prevMatchRuns);

  match.recentBalls.push(tag);
  match.currentOverBalls.push(tag);
  match.cumulativeWorm.push(match.runs);

  const ov = `${Math.floor(match.legalBalls / 6)}.${match.legalBalls % 6}`;
  match.commentary.unshift({
    ball: ov,
    desc: desc,
    type: isWicket ? 'w' : (runs === 4 ? 'four' : (runs === 6 ? 'six' : 'normal'))
  });

  if (!isWicket) {
    if (prevTeam < 50 && match.runs >= 50) {
      setTimeout(() => triggerBanner('TEAM 50 UP! 💯', `${match.teamBatting} reach 50`, 'fx-milestone'), 1900);
    } else if (prevTeam < 100 && match.runs >= 100) {
      setTimeout(() => triggerBanner('TEAM 100 UP! 💯', `${match.teamBatting} reach 100`, 'fx-milestone'), 1900);
    }
  }

  /* ═══════════════════════════════════════════════════════════
     OVER END — atomic block
     ═══════════════════════════════════════════════════════════ */
  let overEnded = false;
  const isRegularLegalOver   = (extra !== 'WD' && extra !== 'NB' && match.legalBalls % 6 === 0 && match.legalBalls > 0);
  const isWideCountLegalOver = (matchConfig.wideCountsAsBall && extra === 'WD' && match.legalBalls % 6 === 0 && match.legalBalls > 0);

  if (isRegularLegalOver || isWideCountLegalOver) {
    try {
      const __tmp = match.striker;
      match.striker    = match.nonStriker;
      match.nonStriker = __tmp;

      const overBalls = [...match.currentOverBalls];
      match.oversTimeline.push({ overNum: match.legalBalls / 6, balls: overBalls });

      const overRunsThisOver = overBalls.reduce((sum, b) => {
        const m = String(b).match(/\d+/);
        return sum + (m ? parseInt(m[0], 10) : 0);
      }, 0);
      const hasExtra  = overBalls.some(b => b.includes('Wd') || b.includes('Nb') || b.includes('B') || b.includes('Lb'));
      const hasWicket = overBalls.some(b => b === 'W');
      const bowlerWas = match.bowlers[match.currentBowler];

      if (overRunsThisOver === 0 && !hasExtra && !hasWicket && bowlerWas) {
        bowlerWas.maidens = (bowlerWas.maidens || 0) + 1;
      }

      match._lastOverRuns = overRunsThisOver;
      match.currentOverBalls  = [];
      match._currentOverRuns  = 0;
      match.previousBowler = match.currentBowler;

      overEnded = true;

      const overNumber = match.legalBalls / 6;
      const stStats = match.batters[match.striker]    || { runs: 0, balls: 0 };
      const nsStats = match.batters[match.nonStriker] || { runs: 0, balls: 0 };
      const bw = match.bowlers[match.currentBowler]   || { balls: 0, maidens: 0, runs: 0, wickets: 0 };
      const ovStr = `${Math.floor(bw.balls / 6)}.${bw.balls % 6}`;
      const summaryDesc = `<span class="sum-line"><b>End of Over ${overNumber}</b> — <span class="sum-team">${match.teamBattingAbbr} ${match.runs}/${match.wickets}</span> • ${overRunsThisOver} run${overRunsThisOver !== 1 ? 's' : ''} this over</span><span class="sum-line">🏏 ${match.striker} <b>${stStats.runs}</b>(${stStats.balls}) • ${match.nonStriker} <b>${nsStats.runs}</b>(${nsStats.balls})</span><span class="sum-line">⚾ <span class="sum-bowler">${match.currentBowler}</span> ${ovStr}-${bw.maidens}-${bw.runs}-<b>${bw.wickets}</b></span>`;
      match.commentary.unshift({ ball: `End Ov ${overNumber}`, desc: summaryDesc, type: 'summary', html: true });
    } catch (err) {
      console.error('[CricMax] Over-end block failed:', err);
      match.currentOverBalls = [];
      match._currentOverRuns = 0;
      match.previousBowler   = match.currentBowler;
      overEnded = true;
    }
  }

  /* ---- Persist + render ---- */
  autoPersist();
  scheduleRender();
  broadcastMatchState(shotPayload);

  /* ---- Voice ---- */
  if (isCommentaryVoiceActive) {
    const shouldSpeak =
      commentaryDensity === 'all' ? true :
      commentaryDensity === 'wickets' ? isWicket :
      commentaryDensity === 'boundaries' ? (isWicket || runs === 4 || runs === 6 || wasFH) :
      commentaryDensity === 'milestones' ? (/CENTURY|FIFTY|WICKET|FIVE-FOR/i.test(desc)) : true;
    if (shouldSpeak) speak(desc);
  }

  if (overEnded) forceBowlerChangePrompt();
  checkMatchEnd();
}

/* ═══════════════════════════════════════════════════════════
   UNDO
   ═══════════════════════════════════════════════════════════ */
function undoDelivery() {
  if (historyStack.length > 0 && !isViewerMode) {
    match = historyStack.pop();
    window.match = match;
    autoPersist();
    scheduleRender();
    broadcastMatchState();
  }
}

/* ═══════════════════════════════════════════════════════════
   MATCH / INNINGS END
   ═══════════════════════════════════════════════════════════ */
function checkMatchEnd() {
  if (!match.isActive || inningsTransitionLock) return;
  if (!match.totalOvers || match.totalOvers <= 0) return;

  if (match.innings === 2 && match.target > 0 && match.runs >= match.target) {
    inningsTransitionLock = true;
    setTimeout(() => { inningsTransitionLock = false; endMatchAndDeclareWinner(true); }, 1500);
    return;
  }
  if (match.legalBalls >= match.totalOvers * 6) {
    inningsTransitionLock = true;
    if (match.innings === 1) {
      setTimeout(() => {
        inningsTransitionLock = false;
        saveInnings1Snapshot();
        transitionToInnings2();
        showInningsBreakModal();
      }, 1200);
    } else {
      setTimeout(() => {
        inningsTransitionLock = false;
        endMatchAndDeclareWinner(true);
      }, 1200);
    }
  }
}

function saveInnings1Snapshot() {
  match.innings1Score = {
    team: match.teamBatting,
    runs: match.runs,
    wickets: match.wickets,
    balls: match.legalBalls
  };
  match.innings1PartnerRuns     = [...match.partnerRuns];
  match.innings1Fow             = [...match.fow];
  match.innings1SectorRuns      = [...match.sectorRuns];
  match.innings1BattingSnapshot = JSON.parse(JSON.stringify(match.batters));
  match.innings1BowlingSnapshot = JSON.parse(JSON.stringify(match.bowlers));
  match.innings1FieldingSnapshot= JSON.parse(JSON.stringify(match.fielding));
}

function transitionToInnings2() {
  match.innings = 2;
  match.target  = match.runs + 1;
  match.runs = 0; match.wickets = 0; match.legalBalls = 0;
  match.recentBalls = []; match.currentOverBalls = [];
  match.cumulativeWorm = [0];
  match.previousBowler = '';
  match.isFreeHit = false;
  match.partnerRuns = [];
  match.fow = [];                      /* ← FIXED: reset FOW between innings */
  match.currentPartnership = { runs: 0, balls: 0, batters: [] };
  match.lastBowlerWkts = [];
  usedPhrases = {};
  match.sectorRuns = [0, 0, 0, 0, 0, 0, 0, 0];
  match.batters = {}; match.bowlers = {}; match.fielding = {}; match.playerTeamMap = {};
  match._currentOverRuns = 0; match._lastOverRuns = 0;
  match.oversTimeline = [];

  const tn = match.teamBatting; match.teamBatting = match.teamBowling; match.teamBowling = tn;
  const ta = match.teamBattingAbbr; match.teamBattingAbbr = match.teamBowlingAbbr; match.teamBowlingAbbr = ta;

  const hTitle = document.getElementById('headerMainTitle');
  const hSub   = document.getElementById('headerSubTitle');
  const tBlock = document.getElementById('targetBlock');
  const tVal   = document.getElementById('targetVal');
  if (hTitle) hTitle.innerText = `${match.teamBatting} vs ${match.teamBowling}`;
  if (hSub)   hSub.innerText   = `Target: ${match.target}`;
  if (tBlock) tBlock.style.display = 'block';
  if (tVal)   tVal.innerText = match.target;

  autoPersist();
  broadcastMatchState();
}

function showInningsBreakModal() {
  const s = match.innings1Score;
  if (!s) return;
  document.getElementById('breakModalTitle').innerText = `1st Innings Ended: ${s.team} ${s.runs}/${s.wickets}`;
  document.getElementById('breakTargetSummary').innerText = `Target for ${match.teamBatting}: ${match.target} runs in ${match.totalOvers} overs`;

  const batBody = document.getElementById('breakBattingBody');
  batBody.innerHTML = '';
  const snapshot = match.innings1BattingSnapshot || {};
  Object.keys(snapshot).forEach(name => {
    const b = snapshot[name];
    if (b.status && b.status !== 'dnb') {
      const sr = b.balls > 0 ? ((b.runs / b.balls) * 100).toFixed(1) : '0.0';
      batBody.innerHTML += `<tr>
        <td><span class="player-link" onclick="openPlayerCareerModal('${escapeHtml(name).replace(/'/g, "\\'")}')"><b>${escapeHtml(name)}</b></span><br><small style="color:var(--muted);">${escapeHtml(b.status)}</small></td>
        <td class="text-right"><b>${b.runs}</b></td><td class="text-right">${b.balls}</td>
        <td class="text-right">${b.fours}</td><td class="text-right">${b.sixes}</td>
        <td class="text-right">${sr}</td></tr>`;
    }
  });

  const bowlBody = document.getElementById('breakBowlingBody');
  bowlBody.innerHTML = '';
  const bsnap = match.innings1BowlingSnapshot || {};
  Object.keys(bsnap).forEach(name => {
    const bw = bsnap[name];
    if (bw.balls > 0) {
      const ovStr = `${Math.floor(bw.balls / 6)}.${bw.balls % 6}`;
      const eco = bw.balls > 0 ? (bw.runs / (bw.balls / 6)).toFixed(2) : '0.0';
      bowlBody.innerHTML += `<tr>
        <td><span class="player-link" onclick="openPlayerCareerModal('${escapeHtml(name).replace(/'/g, "\\'")}')"><b>${escapeHtml(name)}</b></span></td>
        <td class="text-right">${ovStr}</td><td class="text-right">${bw.maidens || 0}</td>
        <td class="text-right">${bw.runs}</td><td class="text-right"><b>${bw.wickets}</b></td>
        <td class="text-right">${eco}</td></tr>`;
    }
  });

  const fowBox = document.getElementById('breakFowBody');
  fowBox.innerHTML = (match.innings1Fow && match.innings1Fow.length > 0)
    ? match.innings1Fow.map(f => `<div style="padding:3px 0;">${escapeHtml(f)}</div>`).join('')
    : 'No wickets fell.';

  document.getElementById('inningsBreakModal').style.display = 'flex';
  if (isCommentaryVoiceActive) {
    speak(`First innings concluded. ${s.team} scored ${s.runs} for ${s.wickets}. ${match.teamBatting} need ${match.target} to win.`);
  }
}

function proceedToSecondInningsSetup() {
  closeModal('inningsBreakModal');
  openInnings2Setup();
}

function endInningsPrompt() {
  if (!match.isActive || isViewerMode) return;
  const title  = document.getElementById('endInningsTitle');
  const desc   = document.getElementById('endInningsDesc');
  const score  = document.getElementById('endInningsScore');
  const overs  = document.getElementById('endInningsOvers');
  const ovStr  = `${Math.floor(match.legalBalls / 6)}.${match.legalBalls % 6}`;
  if (match.innings === 1) {
    if (title) title.innerText = 'End 1st Innings?';
    if (desc)  desc.innerText  = `${match.teamBatting} innings will end and ${match.teamBowling} will chase.`;
    if (score) score.innerText = `${match.runs}/${match.wickets}`;
    if (overs) overs.innerText = `${ovStr} / ${match.totalOvers} overs`;
  } else {
    if (title) title.innerText = 'End 2nd Innings?';
    if (desc)  desc.innerText  = 'Match will end. Winner will be declared.';
    if (score) score.innerText = `${match.runs}/${match.wickets}`;
    if (overs) overs.innerText = `${ovStr} / ${match.totalOvers} overs (Target: ${match.target})`;
  }
  document.getElementById('endInningsModal').style.display = 'flex';
}

function confirmEndInnings() {
  closeModal('endInningsModal');
  inningsTransitionLock = false;
  if (!match || !match.isActive) return;
  if (match.innings === 1) {
    try { saveInnings1Snapshot(); } catch (e) {}
    try { transitionToInnings2(); } catch (e) {}
    try { showInningsBreakModal(); } catch (e) {}
  } else {
    try { endMatchAndDeclareWinner(true); } catch (e) {}
  }
}

function openInnings2Setup() {
  const bat  = savedTeams.find(t => t.name === match.teamBatting) || { name: match.teamBatting, squad: [] };
  const bowl = savedTeams.find(t => t.name === match.teamBowling) || { name: match.teamBowling, squad: [] };
  const bo = (bat.squad  || []).map(p => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join('') || '<option value="">-- No players --</option>';
  const wo = (bowl.squad || []).map(p => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join('') || '<option value="">-- No players --</option>';
  document.getElementById('i2Subtitle').innerText = `${bat.name} need ${match.target} to win`;
  document.getElementById('i2Striker').innerHTML    = bo;
  document.getElementById('i2NonStriker').innerHTML = bo;
  document.getElementById('i2Bowler').innerHTML     = wo;
  document.getElementById('i2StrikerNew').value    = '';
  document.getElementById('i2NonStrikerNew').value = '';
  document.getElementById('i2BowlerNew').value     = '';
  document.getElementById('i2Modal').style.display = 'flex';
}

function beginSecondInnings() {
  const s  = autoCapitalize((document.getElementById('i2StrikerNew').value    || document.getElementById('i2Striker').value    || '').trim());
  const ns = autoCapitalize((document.getElementById('i2NonStrikerNew').value || document.getElementById('i2NonStriker').value || '').trim());
  const b  = autoCapitalize((document.getElementById('i2BowlerNew').value     || document.getElementById('i2Bowler').value     || '').trim());

  if (!s || !ns || !b) return alert("Select all players");
  if (s.toLowerCase() === ns.toLowerCase()) return alert("Must be different");

  if (document.getElementById('i2StrikerNew').value.trim())    autoAddPlayerToTeam(s,  match.teamBatting);
  if (document.getElementById('i2NonStrikerNew').value.trim()) autoAddPlayerToTeam(ns, match.teamBatting);
  if (document.getElementById('i2BowlerNew').value.trim())     autoAddPlayerToTeam(b,  match.teamBowling);

  const bat  = savedTeams.find(t => t.name === match.teamBatting) || { squad: [] };
  const bowl = savedTeams.find(t => t.name === match.teamBowling) || { squad: [] };
  match.batters = {};
  match.bowlers = {};
  [...new Set([...(bat.squad || []), s, ns])].forEach(p => {
    match.batters[p] = { runs: 0, balls: 0, fours: 0, sixes: 0, dots: 0, fifties: 0, hundreds: 0, status: "dnb" };
    match.playerTeamMap[p] = match.teamBattingAbbr;
  });
  match.batters[s].status  = "batting";
  match.batters[ns].status = "batting";
  [...new Set([...(bowl.squad || []), b])].forEach(p => {
    match.bowlers[p] = { balls: 0, maidens: 0, runs: 0, wickets: 0, dots: 0, threeW: 0, fiveW: 0 };
    match.playerTeamMap[p] = match.teamBowlingAbbr;
  });
  match.striker = s; match.nonStriker = ns; match.currentBowler = b;
  match.currentPartnership = { runs: 0, balls: 0, batters: [s, ns] };
  closeModal('i2Modal');

  if (!isCommentaryVoiceActive) {
    isCommentaryVoiceActive = true;
    const btnSound = document.getElementById('btnSoundToggle');
    if (btnSound) btnSound.classList.add('active');
    const icon = document.getElementById('soundIcon');
    if (icon) icon.innerText = '🔊';
    primeSpeech();
  }

  playIPLOpening(match.teamBatting, match.teamBattingAbbr, match.teamBowling, match.teamBowlingAbbr, 'Target: ' + match.target + ' runs', () => {
    selectSubPane('live');
    renderLive();
    renderCommentary();
    autoPersist();
    broadcastMatchState();
    triggerBanner('2ND INNINGS! 🏏', `${match.teamBatting} need ${match.target}`, 'fx-milestone');
    if (isCommentaryVoiceActive) speak(`Second innings underway. ${match.teamBatting} need ${match.target} to win.`);
  }, {
    topLabel: '🏏 2ND INNINGS 🏏',
    beginText: 'Chase Begins',
    bottomText: 'Target: ' + match.target + ' runs',
    voiceIntro: `Second innings underway. ${match.teamBatting} need ${match.target} runs to win. Let's play!`
  });
}

function computeManOfTheMatch() {
  const pool = buildStatsPool();
  if (!pool.length) return null;
  return pool.reduce((best, p) => (p.mvp > best.mvp ? p : best), pool[0]);
}

function endMatchAndDeclareWinner(skipConfirm = false) {
  if (!match.isActive) return;
  if (!skipConfirm && !confirm("End match?")) return;

  let winner = 'tie', margin = 'Match tied';
  const first = match.innings1Score;
  const i1t = first ? first.team : match.teamBowling;
  const i1s = first ? `${first.runs}/${first.wickets}` : '0/0';
  const i2t = match.teamBatting;
  const i2s = `${match.runs}/${match.wickets}`;

  if (match.innings === 2 && first) {
    if (match.runs >= match.target)       { winner = i2t; margin = `${i2t} won by ${10 - match.wickets} wkts`; }
    else if (match.runs === first.runs)   { winner = 'tie'; margin = 'Match tied'; }
    else                                   { winner = i1t; margin = `${i1t} won by ${first.runs - match.runs} runs`; }
  }

  const entry = {
    fixture: `${i1t} vs ${i2t}`,
    result: margin,
    venue: match.venue,
    date: new Date().toLocaleDateString(),
    teamA: i1t, teamB: i2t, winner: winner,
    innings1: {
      team: i1t,
      runs:    first ? first.runs    : 0,
      wickets: first ? first.wickets : 0,
      balls:   first ? first.balls   : 0,
      batters:  match.innings1BattingSnapshot  || {},
      bowlers:  match.innings1BowlingSnapshot  || {},
      fielding: match.innings1FieldingSnapshot || {}
    },
    innings2: {
      team: i2t,
      runs: match.runs, wickets: match.wickets, balls: match.legalBalls,
      batters:  JSON.parse(JSON.stringify(match.batters)),
      bowlers:  JSON.parse(JSON.stringify(match.bowlers)),
      fielding: JSON.parse(JSON.stringify(match.fielding))
    }
  };

  const motm = computeManOfTheMatch();
  match.motm = motm ? {
    name: motm.name, mvp: motm.mvp,
    runs: motm.runs, balls: motm.balls,
    wickets: motm.wickets, bowlRuns: motm.bowlRuns,
    catches: motm.catches, sr: motm.sr, eco: motm.eco
  } : null;

  pastMatchesLedger.unshift(entry);
  match.isActive = false;

  if (isCommentaryVoiceActive) speak(`Match finished! ${margin}. Congratulations!`);

  playIPLOpening(
    winner === 'tie' ? i1t : winner,
    winner === 'tie' ? 'TIE' : winner.substring(0, 3).toUpperCase(),
    winner === 'tie' ? i2t : (winner === i1t ? i2t : i1t),
    winner === 'tie' ? 'TIE' : (winner === i1t ? i2t : i1t).substring(0, 3).toUpperCase(),
    '🏆 ' + margin,
    () => {
      document.getElementById('resultWinner').innerText = (winner === 'tie') ? 'Match Tied' : `🏆 ${winner}`;
      document.getElementById('resultMargin').innerText = margin;
      document.getElementById('resultScores').innerHTML = `
        <div style="display:flex;justify-content:space-between;padding:10px;background:rgba(255,255,255,.04);border-radius:8px;margin-bottom:8px;">
          <span>${escapeHtml(i1t)}</span><b>${i1s}</b>
        </div>
        <div style="display:flex;justify-content:space-between;padding:10px;background:rgba(255,255,255,.04);border-radius:8px;">
          <span>${escapeHtml(i2t)}</span><b>${i2s}</b>
        </div>`;
      if (match.motm) {
        const box     = document.getElementById('motmBox');
        const nameEl  = document.getElementById('motmName');
        const statsEl = document.getElementById('motmStats');
        if (box) {
          box.style.display = 'block';
          nameEl.innerText = match.motm.name;
          const parts = [];
          if (match.motm.runs > 0)    parts.push(`${match.motm.runs}(${match.motm.balls}) • SR ${match.motm.sr.toFixed(1)}`);
          if (match.motm.wickets > 0) parts.push(`${match.motm.wickets}/${match.motm.bowlRuns} • Eco ${match.motm.eco.toFixed(2)}`);
          if (match.motm.catches)     parts.push(`${match.motm.catches} catch${match.motm.catches > 1 ? 'es' : ''}`);
          statsEl.innerText = parts.join('  |  ');
        }
      }
      document.getElementById('resultModal').style.display = 'flex';
      const ub = document.getElementById('undoBtn');        if (ub) ub.style.display = 'none';
      const sb = document.getElementById('btnSoundToggle'); if (sb) sb.style.display = 'none';
      renderPointsTable();
      renderPastMatchesList();
      updateContinueButton();
      autoPersist();
      broadcastMatchState();
      updateLiveShareBadge();
    },
    { topLabel: '🏆 MATCH RESULT 🏆', beginText: 'Champion', bottomText: margin, voiceIntro: `Match finished! ${margin}.` }
  );
}

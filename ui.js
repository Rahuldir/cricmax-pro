/* ============================================================
   ui.js — Navigation, panes, modals, settings, IPL opening, finalize
   ============================================================ */

function isOnHomePage() {
  const homeView = document.getElementById('view-home');
  return homeView && homeView.style.display !== 'none';
}

function updateBottomNavActive(pane) {
  document.querySelectorAll('.bottom-nav-btn').forEach(b => b.classList.remove('active'));
  if (pane === 'home') return;
  const ab = document.getElementById('bNav-' + pane);
  if (ab) ab.classList.add('active');
}

function bottomNavAction(action) {
  if (action === 'more') { openMoreOptionsModal(); return; }
  if (isOnHomePage()) {
    if (action === 'live') {
      if (match.isActive) launchDashboard('live');
      else openMatchPicker();
    } else launchDashboard(action);
  } else selectSubPane(action);
}

function launchDashboard(paneId) {
  const homeView = document.getElementById('view-home');
  const dashView = document.getElementById('view-dashboard');
  if (homeView) homeView.style.display = 'none';
  if (dashView) dashView.style.display = 'block';
  const backHome = document.getElementById('btnBackHome');
  const undoBtn = document.getElementById('undoBtn');
  if (backHome) backHome.style.display = isViewerMode ? 'none' : 'flex';
  if (undoBtn) undoBtn.style.display = (match.isActive && !isViewerMode) ? 'flex' : 'none';
  selectSubPane(paneId);
  updateTournamentProfileCard();
  renderPastMatchesList();
  renderTeamsList();
  renderPointsTable();
  updateSettingsSummary();
  updateLiveShareBadge();
}

function goToHomeScreen() {
  const homeView = document.getElementById('view-home');
  const dashView = document.getElementById('view-dashboard');
  if (homeView) homeView.style.display = 'block';
  if (dashView) dashView.style.display = 'none';
  const backHome = document.getElementById('btnBackHome');
  const undoBtn = document.getElementById('undoBtn');
  if (backHome) backHome.style.display = 'none';
  if (undoBtn) undoBtn.style.display = 'none';
  updateBottomNavActive('home');
  archiveCurrentTournament();
}

function selectSubPane(paneId) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.sub-pane').forEach(p => p.classList.remove('active'));
  const tabs = ['tournament', 'live', 'summary', 'scorecard', 'analytics', 'leaderboards', 'teams', 'info'];
  const idx = tabs.indexOf(paneId);
  const tabButtons = document.querySelectorAll('.tab-btn');
  if (idx >= 0 && tabButtons[idx]) tabButtons[idx].classList.add('active');
  const ap = document.getElementById('pane-' + paneId);
  if (ap) ap.classList.add('active');
  if (paneId === 'tournament') {
    renderPastMatchesList();
    renderPointsTable();
    updateContinueButton();
    setTimeout(injectClearDataPanel, 60);
  }
  if (paneId === 'teams') renderTeamsList();
  if (paneId === 'live') { renderLive(); renderCommentary(); updateSettingsSummary(); updateLiveShareBadge(); }
  if (paneId === 'summary') renderSummary();
  if (paneId === 'analytics') renderNzcAnalytics();
  if (paneId === 'leaderboards') renderStatsCategory(currentStatsCategory);
  if (['live', 'scorecard', 'analytics', 'leaderboards'].includes(paneId)) updateBottomNavActive(paneId);
  else updateBottomNavActive(null);
}

function openMoreOptionsModal() { document.getElementById('moreOptionsModal').style.display = 'flex'; }

function closeModal(id) {
  if (id === 'wagonModal') { clearTimeout(window._wagonTimer); pendingRuns = 0; }
  const el = document.getElementById(id);
  if (el) el.style.display = 'none';
}

function switchScorecardTab(el, tab) {
  document.querySelectorAll('.sc-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  const batEl = document.getElementById('sc-batting');
  const bowlEl = document.getElementById('sc-bowling');
  if (batEl) batEl.style.display = tab === 'batting' ? 'block' : 'none';
  if (bowlEl) bowlEl.style.display = tab === 'bowling' ? 'block' : 'none';
}

/* ============ SETTINGS ============ */
function setConfig(key, val, btnEl, groupId) {
  matchConfig[key] = val;
  autoPersist();
  if (btnEl && groupId) {
    document.querySelectorAll(`#${groupId} .seg-btn`).forEach(b => b.classList.remove('active'));
    btnEl.classList.add('active');
  }
  updateSettingsSummary();
}

function toggleConfig(key, el) {
  matchConfig[key] = !matchConfig[key];
  if (matchConfig[key]) el.classList.add('on');
  else el.classList.remove('on');
  if (key === 'forceFreeHit') {
    match.isFreeHit = matchConfig.forceFreeHit;
    autoPersist();
    const t = document.getElementById('fhStateText');
    if (t) t.innerText = match.isFreeHit ? 'Yes' : 'No';
  }
  autoPersist();
  updateSettingsSummary();
}

function syncSettingsUI() {
  setSegActive('cfgWideRuns', matchConfig.wideRuns);
  const wLeg = document.getElementById('cfgWideLegal');
  if (wLeg) wLeg.classList.toggle('on', !!matchConfig.wideCountsAsBall);
  setSegActive('cfgNBRuns', matchConfig.nbRuns);
  const aFH = document.getElementById('cfgAutoFH');
  if (aFH) aFH.classList.toggle('on', !!matchConfig.autoFreeHitOnNB);
  setSegActive('cfgByeRuns', matchConfig.byeRunsDefault);
  setSegActive('cfgLBRuns', matchConfig.legByeRunsDefault);
  setSegActive('cfgMaxOv', matchConfig.maxOversPerBowler);
  const drs = document.getElementById('cfgDRS');
  if (drs) drs.classList.toggle('on', !!matchConfig.autoDetectStumpings);
  const fFH = document.getElementById('cfgForceFH');
  if (fFH) fFH.classList.toggle('on', !!matchConfig.forceFreeHit);
  const densSel = document.getElementById('cfgVoiceDensity');
  if (densSel) densSel.value = commentaryDensity;
}

function setSegActive(groupId, val) {
  const g = document.getElementById(groupId);
  if (!g) return;
  const targetVal = (typeof val === 'number') ? val : parseInt(val, 10);
  g.querySelectorAll('.seg-btn').forEach(b => {
    const btnVal = parseInt(b.dataset.val, 10);
    b.classList.toggle('active', btnVal === targetVal);
  });
}

function openSettingsModal() {
  upgradeSettingsDropdowns();
  syncSettingsUI();
  document.getElementById('settingsModal').style.display = 'flex';
}

function openExtrasModal() {
  const t = document.getElementById('fhStateText');
  if (t) t.innerText = match.isFreeHit ? 'Yes' : 'No';
  document.getElementById('extrasModal').style.display = 'flex';
}

function saveSettingsAndClose() { autoPersist(); closeModal('settingsModal'); updateSettingsSummary(); }

function resetSettingsToDefaults() {
  matchConfig = Object.assign({}, DEFAULT_CONFIG);
  syncSettingsUI();
  autoPersist();
  updateSettingsSummary();
}

function updateSettingsSummary() {
  const el = document.getElementById('settingsQuickSummary');
  if (!el) return;
  const wr = (typeof matchConfig.wideRuns === 'number') ? matchConfig.wideRuns : 1;
  const nr = (typeof matchConfig.nbRuns === 'number') ? matchConfig.nbRuns : 1;
  el.innerText = `Wide ${wr}r • NB ${nr}r • Bye ${matchConfig.byeRunsDefault}r • LB ${matchConfig.legByeRunsDefault}r • ${matchConfig.autoFreeHitOnNB ? 'Auto-FH' : 'No-Auto-FH'}`;
}

function setConfigFromSelect(key, val) {
  matchConfig[key] = parseInt(val, 10);
  if (isNaN(matchConfig[key])) matchConfig[key] = 0;
  autoPersist();
  updateSettingsSummary();
}

function upgradeSettingsDropdowns() {
  function makeDropdown(selectId, values, current, onChange) {
    let html = `<select class="form-control" id="${selectId}" onchange="${onChange}" style="width:100px;padding:6px 8px;font-size:13px;font-weight:800;background:rgba(0,0,0,.4);border:1px solid var(--card-border);color:#fff;">`;
    values.forEach(v => { html += `<option value="${v}"${v === current ? ' selected' : ''}>${v}</option>`; });
    html += '</select>';
    return html;
  }
  const cfgW = document.getElementById('cfgWideRuns');
  if (cfgW && cfgW.tagName !== 'SELECT') {
    const wr = (typeof matchConfig.wideRuns === 'number') ? matchConfig.wideRuns : 1;
    cfgW.outerHTML = makeDropdown('cfgWideRunsSelect', [0, 1, 2, 3, 4, 5], wr, "setConfigFromSelect('wideRuns',this.value)");
  }
  const cfgN = document.getElementById('cfgNBRuns');
  if (cfgN && cfgN.tagName !== 'SELECT') {
    const nr = (typeof matchConfig.nbRuns === 'number') ? matchConfig.nbRuns : 1;
    cfgN.outerHTML = makeDropdown('cfgNBRunsSelect', [0, 1, 2, 3, 4, 5], nr, "setConfigFromSelect('nbRuns',this.value)");
  }
  const cfgB = document.getElementById('cfgByeRuns');
  if (cfgB && cfgB.tagName !== 'SELECT') {
    const br = (typeof matchConfig.byeRunsDefault === 'number') ? matchConfig.byeRunsDefault : 1;
    cfgB.outerHTML = makeDropdown('cfgByeRunsSelect', [1, 2, 3, 4, 5, 6], br, "setConfigFromSelect('byeRunsDefault',this.value)");
  }
  const cfgLB = document.getElementById('cfgLBRuns');
  if (cfgLB && cfgLB.tagName !== 'SELECT') {
    const lbr = (typeof matchConfig.legByeRunsDefault === 'number') ? matchConfig.legByeRunsDefault : 1;
    cfgLB.outerHTML = makeDropdown('cfgLBRunsSelect', [1, 2, 3, 4, 5, 6], lbr, "setConfigFromSelect('legByeRunsDefault',this.value)");
  }
}

/* ============ IPL OPENING ============ */
function playIPLOpening(t1Name, t1Abbr, t2Name, t2Abbr, venue, cb, opts = {}) {
  const el = document.getElementById('iplOpening');
  if (!el) { if (cb) cb(); return; }
  el.classList.remove('active');
  el.style.opacity = '1';
  el.style.transition = '';
  document.getElementById('iplTeam1Badge').innerText = (t1Abbr || t1Name || 'T1').toUpperCase();
  document.getElementById('iplTeam1Name').innerText = t1Name || 'Team One';
  document.getElementById('iplTeam2Badge').innerText = (t2Abbr || t2Name || 'T2').toUpperCase();
  document.getElementById('iplTeam2Name').innerText = t2Name || 'Team Two';
  document.getElementById('iplVenueText').innerText = (opts.bottomText || venue || 'Local Stadium').toUpperCase();
  document.getElementById('iplTopLabel').innerText = opts.topLabel || '⚡ CRICMAX PRO ⚡';
  document.getElementById('iplBeginText').innerText = opts.beginText || 'Match Begins';
  const countdownEl = document.getElementById('iplCountdown');
  countdownEl.innerText = '';
  countdownEl.classList.remove('active');
  void el.offsetWidth;
  el.classList.add('active');
  if (isCommentaryVoiceActive) {
    const intro = opts.voiceIntro || `Welcome to CricMax Pro. ${t1Name} versus ${t2Name}. Let the match begin!`;
    try { speak(intro); } catch (e) {}
  }
  const startCountdown = () => {
    if (!countdownEl) return;
    let num = 5;
    countdownEl.classList.add('active');
    const tick = () => {
      if (num > 0) { countdownEl.innerText = num; num--; setTimeout(tick, 900); }
      else {
        countdownEl.innerText = 'GO!';
        setTimeout(() => { countdownEl.classList.remove('active'); countdownEl.innerText = ''; }, 700);
      }
    };
    tick();
  };
  setTimeout(startCountdown, 4500);
  setTimeout(() => {
    el.style.transition = 'opacity 1s ease-out';
    el.style.opacity = '0';
    setTimeout(() => {
      el.classList.remove('active');
      el.style.opacity = '1';
      el.style.transition = '';
      if (cb) cb();
    }, 1000);
  }, 9000);
}

/* ============ FINALIZE MATCH START ============ */
function finalizeMatchStart() {
  const batName = document.getElementById('battingTeamSelect').value;
  let bowlName;
  if (batName === RESOLVED_TEAM_1) bowlName = RESOLVED_TEAM_2;
  else if (batName === RESOLVED_TEAM_2) bowlName = RESOLVED_TEAM_1;
  else { alert('Team mismatch'); return; }

  const striker = autoCapitalize((document.getElementById('strikerCustom').value || document.getElementById('strikerDropdown').value || 'Batter 1').trim());
  const nonStriker = autoCapitalize((document.getElementById('nonStrikerCustom').value || document.getElementById('nonStrikerDropdown').value || 'Batter 2').trim());
  const bowler = autoCapitalize((document.getElementById('bowlerCustom').value || document.getElementById('bowlerDropdown').value || 'Bowler 1').trim());
  if (striker.toLowerCase() === nonStriker.toLowerCase()) { alert("Striker and Non-Striker must be different"); return; }

  autoAddPlayerToTeam(striker, batName);
  autoAddPlayerToTeam(nonStriker, batName);
  autoAddPlayerToTeam(bowler, bowlName);

  let lockedOvers = 0;
  if (pendingMatchOvers && pendingMatchOvers > 0) lockedOvers = pendingMatchOvers;
  else if (currentTourn && currentTourn.overs > 0) lockedOvers = parseInt(currentTourn.overs, 10);
  else {
    const inp = document.getElementById('tOversInput');
    if (inp && inp.value) lockedOvers = parseInt(inp.value, 10) || 20;
    else lockedOvers = 20;
  }
  if (lockedOvers <= 0) lockedOvers = 20;
  if (lockedOvers > 50) lockedOvers = 50;

  match.isActive = true;
  match.innings = 1;
  match.totalOvers = lockedOvers;
  match.originalOvers = lockedOvers;
  match.totalOversLocked = true;
  match.venue = pendingMatchVenue || (currentTourn ? currentTourn.venue : 'Local Stadium');
  match.teamBatting = batName;
  match.teamBowling = bowlName;
  match.teamBattingAbbr = batName.substring(0, 3).toUpperCase();
  match.teamBowlingAbbr = bowlName.substring(0, 3).toUpperCase();
  match.runs = 0; match.wickets = 0; match.legalBalls = 0; match.target = 0;
  match.striker = striker; match.nonStriker = nonStriker; match.currentBowler = bowler;
  match.previousBowler = "";
  match.batters = {}; match.bowlers = {}; match.fielding = {}; match.playerTeamMap = {};
  match.recentBalls = []; match.commentary = []; match.fow = [];
  match.cumulativeWorm = [0];
  match.sectorRuns = [0, 0, 0, 0, 0, 0, 0, 0];
  match.currentOverBalls = [];
  match.isFreeHit = false;
  match.partnerRuns = [];
  match.currentPartnership = { runs: 0, balls: 0, batters: [striker, nonStriker] };
  match.innings1Score = null;
  match.lastBowlerWkts = [];
  usedPhrases = {};
  match.shotLog = [];
  match.innings1PartnerRuns = [];
  match.innings1Fow = [];
  match.innings1SectorRuns = [0, 0, 0, 0, 0, 0, 0, 0];
  match.innings2SectorRuns = [0, 0, 0, 0, 0, 0, 0, 0];
  match.innings1BattingSnapshot = null;
  match.innings1BowlingSnapshot = null;
  match.innings1FieldingSnapshot = null;
  match._currentOverRuns = 0;
  match._lastOverRuns = 0;
  match.motm = null;
  inningsTransitionLock = false;

  matchCode = generateMatchCode();
  match.shareCode = matchCode;
  try { localStorage.setItem('currentMatchCode', matchCode); } catch (e) {}
  console.info('[CricMax] 📡 Match code:', matchCode, '| Overs locked:', lockedOvers);

  const bT = savedTeams.find(t => t.name === batName) || { squad: [] };
  const wT = savedTeams.find(t => t.name === bowlName) || { squad: [] };

  [...new Set([...(bT.squad || []), striker, nonStriker])].forEach(p => {
    match.batters[p] = { runs: 0, balls: 0, fours: 0, sixes: 0, dots: 0, fifties: 0, hundreds: 0, status: "dnb" };
    match.playerTeamMap[p] = match.teamBattingAbbr;
  });
  match.batters[striker].status = "batting";
  match.batters[nonStriker].status = "batting";

  [...new Set([...(wT.squad || []), bowler])].forEach(p => {
    match.bowlers[p] = { balls: 0, maidens: 0, runs: 0, wickets: 0, dots: 0, threeW: 0, fiveW: 0 };
    match.playerTeamMap[p] = match.teamBowlingAbbr;
  });

  const hTitle = document.getElementById('headerMainTitle');
  const hSub = document.getElementById('headerSubTitle');
  if (hTitle) hTitle.innerText = `${batName} vs ${bowlName}`;
  if (hSub) hSub.innerText = `${match.venue} • Innings 1 • ${lockedOvers} ov`;

  const infoTourn = document.getElementById('infoTourn');
  const infoFix = document.getElementById('infoFixture');
  const infoVen = document.getElementById('infoVenue');
  const infoOv = document.getElementById('infoOvers');
  if (infoTourn) infoTourn.innerText = currentTourn ? currentTourn.name : 'Match';
  if (infoFix) infoFix.innerText = `${batName} vs ${bowlName}`;
  if (infoVen) infoVen.innerText = match.venue;
  if (infoOv) infoOv.innerText = match.totalOvers;

  const sndBtn = document.getElementById('btnSoundToggle');
  if (sndBtn) sndBtn.style.display = 'flex';

  closeModal('openingRolesModal');
  updateContinueButton();
  autoPersist();

  if (matchCode) registerViewerPresence(matchCode);

  if (!isCommentaryVoiceActive) {
    isCommentaryVoiceActive = true;
    if (sndBtn) sndBtn.classList.add('active');
    const icon = document.getElementById('soundIcon');
    if (icon) icon.innerText = '🔊';
    primeSpeech();
  }

  playIPLOpening(batName, match.teamBattingAbbr, bowlName, match.teamBowlingAbbr, match.venue, () => {
    launchDashboard('live');
    renderLive();
    renderCommentary();
    broadcastMatchState();
    updateSettingsSummary();
    updateLiveShareBadge();
    setTimeout(() => {
      if (isCommentaryVoiceActive) speak(`Play ball! ${striker} and ${nonStriker} at the crease. ${bowler} to bowl the first over.`);
    }, 400);
  }, { topLabel: '⚡ CRICMAX PRO ⚡', beginText: 'Match Begins', bottomText: match.venue });
}

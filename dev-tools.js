/* ============================================================
   dev-tools.js — Edit last ball, clear data, dev seeder
   ============================================================ */

function editLastBall() {
  if (!match.isActive || isViewerMode) return showToast('Match not active');
  if (!match.shotLog || match.shotLog.length === 0) return showToast('No ball to edit');
  const last = match.shotLog[match.shotLog.length - 1];
  if (last.isWicket) return showToast('Wicket balls can\'t be edited — use Undo');
  undoDelivery();
  setTimeout(() => {
    if (last.extra === 'WD') promptWideWithRuns();
    else if (last.extra === 'NB') promptNoBallWithRuns();
    else if (last.runs === 0) recordBall(0);
    else promptWagonWheel(last.runs);
  }, 80);
  showToast('✏️ Re-enter last ball');
}

/* ============ CLEAR DATA ============ */
function injectClearDataPanel() {
  const pane = document.getElementById('pane-tournament');
  if (!pane) return;
  if (document.getElementById('clearDataPanel')) return;
  const html = ''
    + '<div class="section-header-banner" style="margin-top:20px;border-left-color:var(--red);background:linear-gradient(90deg,rgba(239,68,68,.15),transparent);">'
    +   '<span>🗑️</span> Clear Data'
    + '</div>'
    + '<div class="panel-card" id="clearDataPanel" style="border:1px solid rgba(239,68,68,.35);">'
    +   '<div style="font-size:12px;color:var(--muted);margin-bottom:10px;">Delete specific data. This cannot be undone.</div>'
    +   '<div style="display:grid;gap:8px;">'
    +     '<button class="btn-ui" style="text-align:left;padding:12px;background:rgba(239,68,68,.12);border-color:rgba(239,68,68,.4);color:#fca5a5;" onclick="clearMatchStats()">'
    +       '<b>🧹 Clear Match Stats</b><br><small style="font-size:10px;opacity:.8;">Clears shots, commentary, worm, wagon wheel — keeps teams & players</small></button>'
    +     '<button class="btn-ui" style="text-align:left;padding:12px;background:rgba(251,191,36,.12);border-color:rgba(251,191,36,.4);color:#fbbf24;" onclick="clearPlayerStats()">'
    +       '<b>👤 Clear Player Stats</b><br><small style="font-size:10px;opacity:.8;">Resets all player career records, batting/bowling/fielding stats</small></button>'
    +     '<button class="btn-ui" style="text-align:left;padding:12px;background:rgba(168,85,247,.12);border-color:rgba(168,85,247,.4);color:#e9d5ff;" onclick="clearTournamentData()">'
    +       '<b>🏆 Delete Tournament</b><br><small style="font-size:10px;opacity:.8;">Removes current tournament, its teams, and past matches</small></button>'
    +     '<button class="btn-ui" style="text-align:left;padding:12px;background:rgba(239,68,68,.2);border-color:var(--red);color:#fca5a5;" onclick="clearEverything()">'
    +       '<b>⚠️ Clear ALL Data</b><br><small style="font-size:10px;opacity:.8;">Full wipe — everything from localStorage & cloud</small></button>'
    +   '</div>'
    + '</div>';
  pane.insertAdjacentHTML('beforeend', html);
}

function clearMatchStats() {
  if (!confirm('🧹 Clear all match stats?\n\nThis will remove:\n• Shots log\n• Commentary\n• Wagon wheel data\n• Worm chart\n• This over history\n\nTeams & players stay.\n\nContinue?')) return;
  try {
    match.shotLog = [];
    match.commentary = [];
    match.recentBalls = [];
    match.currentOverBalls = [];
    match.cumulativeWorm = [0];
    match.oversTimeline = [];
    match.sectorRuns = [0, 0, 0, 0, 0, 0, 0, 0];
    match.fow = [];
    match.partnerRuns = [];
    match.currentPartnership = { runs: 0, balls: 0, batters: [] };
    match.innings1BattingSnapshot = null;
    match.innings1BowlingSnapshot = null;
    match.innings1FieldingSnapshot = null;
    match.innings1Fow = [];
    match.innings1PartnerRuns = [];
    match.innings1SectorRuns = [0, 0, 0, 0, 0, 0, 0, 0];
    match.innings2SectorRuns = [0, 0, 0, 0, 0, 0, 0, 0];
    match._currentOverRuns = 0;
    match._lastOverRuns = 0;
    historyStack = [];
    autoPersist();
    scheduleRender();
    broadcastMatchState();
    showToast('✅ Match stats cleared');
  } catch (e) { showToast('⚠️ Some stats could not be cleared'); }
}

function clearPlayerStats() {
  if (!confirm('👤 Clear all player career stats?\n\nThis resets:\n• Batting averages & totals\n• Bowling figures\n• Fielding records\n• Career match log\n\nPlayer names in teams stay.\nTeam totals for the current live match stay.\n\nContinue?')) return;
  try {
    for (const n in match.batters) {
      match.batters[n] = { runs: 0, balls: 0, fours: 0, sixes: 0, dots: 0, fifties: 0, hundreds: 0, status: match.batters[n].status || 'dnb' };
    }
    for (const bn in match.bowlers) {
      match.bowlers[bn] = { balls: 0, maidens: 0, runs: 0, wickets: 0, dots: 0, threeW: 0, fiveW: 0 };
    }
    for (const fn in match.fielding) {
      match.fielding[fn] = { catches: 0, stumpings: 0, runOuts: 0 };
    }
    pastMatchesLedger.forEach(pm => {
      if (pm.innings1) { pm.innings1.batters = {}; pm.innings1.bowlers = {}; pm.innings1.fielding = {}; }
      if (pm.innings2) { pm.innings2.batters = {}; pm.innings2.bowlers = {}; pm.innings2.fielding = {}; }
    });
    autoPersist();
    scheduleRender();
    renderStatsCategory(currentStatsCategory);
    broadcastMatchState();
    showToast('✅ Player career stats cleared');
  } catch (e) { showToast('⚠️ Could not clear player stats'); }
}

function clearTournamentData() {
  if (!confirm('🏆 Delete this tournament?\n\nThis removes:\n• Current tournament\n• All teams & squads\n• All past matches\n• Points table\n\nThis CANNOT be undone.\n\nContinue?')) return;
  try {
    try { archiveCurrentTournament(); } catch (e) {}
    currentTourn = null; currentTournId = null;
    savedTeams = []; pastMatchesLedger = [];
    match = emptyMatch();
    window.match = match;
    matchCode = '';
    historyStack = [];
    updateTournamentProfileCard();
    renderPastMatchesList();
    renderTeamsList();
    renderPointsTable();
    updateContinueButton();
    autoPersist();
    showToast('✅ Tournament data deleted');
  } catch (e) { showToast('⚠️ Could not fully clear tournament'); }
}

function clearEverything() {
  if (!confirm('⚠️ DELETE ALL DATA?\n\nThis will remove:\n• Every tournament & match\n• All teams & players\n• All career stats\n• Settings\n• Cloud backup\n\nThis CANNOT be undone!\n\nAre you absolutely sure?')) return;
  if (!confirm('🚨 FINAL WARNING\n\nAre you REALLY sure? Press OK to confirm.')) return;
  try {
    savedTeams = [];
    currentTourn = null;
    currentTournId = null;
    tournamentsHistory = [];
    pastMatchesLedger = [];
    match = emptyMatch();
    window.match = match;
    matchCode = '';
    bowlerTypeMap = {};
    matchConfig = Object.assign({}, DEFAULT_CONFIG);
    historyStack = [];
    usedPhrases = {};
    try { localStorage.removeItem('CricMax_Data'); } catch (e) {}
    try { localStorage.removeItem('CricMax_Theme'); } catch (e) {}
    try {
      if (window.firebaseReady && window.fbAuth && window.fbAuth.currentUser && matchCode) {
        window.fbSetDoc(window.fbDoc(window.fbDb, 'matches', matchCode), { isActive: false, cleared: true, updatedAt: new Date().toISOString() });
      }
    } catch (e) {}
    updateTournamentProfileCard();
    renderPastMatchesList();
    renderTeamsList();
    renderPointsTable();
    updateContinueButton();
    syncSettingsUI();
    updateSettingsSummary();
    updateLiveShareBadge();
    showToast('✅ ALL data cleared. Reloading…', 3000);
    setTimeout(() => location.reload(), 2000);
  } catch (e) { showToast('⚠️ Could not clear all data'); }
}

/* ============ DEV SEEDER (item 30) ============ */
function seedDemoMatch() {
  currentTourn = { name: 'Demo Cup', overs: 5, venue: 'Demo Stadium' };
  currentTournId = 'demo_' + Date.now();
  savedTeams = [
    { name: 'Warriors', squad: ['A Sharma', 'B Patel', 'C Kumar', 'D Singh', 'E Verma'] },
    { name: 'Royals', squad: ['F Khan', 'G Rao', 'H Iyer', 'I Nair', 'J Bose'] }
  ];

  match = emptyMatch();
  window.match = match;
  match.isActive = true;
  match.totalOvers = 5; match.originalOvers = 5; match.totalOversLocked = true;
  match.venue = currentTourn.venue;
  match.teamBatting = 'Warriors'; match.teamBowling = 'Royals';
  match.teamBattingAbbr = 'WAR'; match.teamBowlingAbbr = 'ROY';
  match.striker = 'A Sharma'; match.nonStriker = 'B Patel'; match.currentBowler = 'F Khan';
  match.batters = {};
  savedTeams[0].squad.forEach(p => match.batters[p] = { runs: 0, balls: 0, fours: 0, sixes: 0, dots: 0, fifties: 0, hundreds: 0, status: 'dnb' });
  match.batters['A Sharma'].status = 'batting';
  match.batters['B Patel'].status = 'batting';
  match.bowlers = {};
  savedTeams[1].squad.forEach(p => match.bowlers[p] = { balls: 0, maidens: 0, runs: 0, wickets: 0, dots: 0, threeW: 0, fiveW: 0 });
  match.playerTeamMap = {};
  savedTeams[0].squad.forEach(p => match.playerTeamMap[p] = 'WAR');
  savedTeams[1].squad.forEach(p => match.playerTeamMap[p] = 'ROY');
  matchCode = generateMatchCode();
  match.shareCode = matchCode;

  const opts = [0, 1, 1, 2, 4, 6, 0, 1, 4, 1, 0, 6, 2];
  let bowlerIdx = 0;
  const rotation = ['F Khan', 'G Rao', 'H Iyer'];
  for (let i = 0; i < 30 && match.wickets < 10; i++) {
    if (i > 0 && i % 6 === 0) {
      bowlerIdx = (bowlerIdx + 1) % rotation.length;
      match.currentBowler = rotation[bowlerIdx];
      match.previousBowler = '';
    }
    const r = opts[Math.floor(Math.random() * opts.length)];
    if (Math.random() < 0.08) {
      recordBall(0, null, true, "", 0, { method: 'Bowled', fielder: '' });
      const next = savedTeams[0].squad.find(p => match.batters[p].status === 'dnb');
      if (next) { match.batters[next].status = 'batting'; match.striker = next; }
    } else {
      recordBall(r, null, false, ['Point', 'Cover', 'Mid-wicket', 'Square Leg'][Math.floor(Math.random() * 4)], r >= 6 ? 80 : 0);
    }
  }
  autoPersist();
  launchDashboard('live');
  renderLive(); renderCommentary(); renderScorecard();
  showToast('🎲 Demo data loaded — 5 overs');
}

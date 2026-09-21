/* ============================================================
   main.js — DOMContentLoaded init, keyboard, canvas polyfill, message bus
   ============================================================ */

/* Canvas roundRect polyfill */
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    this.beginPath();
    this.moveTo(x + r, y);
    this.arcTo(x + w, y, x + w, y + h, r);
    this.arcTo(x + w, y + h, x, y + h, r);
    this.arcTo(x, y + h, x, y, r);
    this.arcTo(x, y, x + w, y, r);
    this.closePath();
    return this;
  };
}

window.addEventListener('DOMContentLoaded', () => {
  injectHelpElements();

  if (speechSynth) {
    loadSpeechVoices();
    speechSynth.onvoiceschanged = loadSpeechVoices;
  }

  try { commentaryDensity = localStorage.getItem('CricMax_VoiceDensity') || 'boundaries'; } catch (e) {}
  const densSel = document.getElementById('cfgVoiceDensity');
  if (densSel) densSel.value = commentaryDensity;

  function startFirebaseAuth() {
    if (!window.fbOnAuthStateChanged || !window.fbAuth) { setTimeout(startFirebaseAuth, 300); return; }
    window.fbOnAuthStateChanged(window.fbAuth, (user) => {
      if (user) { window.firebaseReady = true; firebaseAuthReady = true; }
      else window.fbSignInAnonymously(window.fbAuth).catch(err => console.error("Firebase auth failed:", err));
    });
  }
  startFirebaseAuth();

  const params = new URLSearchParams(location.search);
  if (params.get('viewer') === '1') {
    isViewerMode = true;
    document.body.classList.add('viewer-mode');
    const subTitle = document.getElementById('headerSubTitle');
    if (subTitle) subTitle.innerText = '📺 Viewer Mode';
    const landing = document.getElementById('viewerLanding');
    const landingCode = document.getElementById('viewerLandingCode');
    if (landing) {
      landing.style.display = 'flex';
      const cp = params.get('code');
      if (landingCode) landingCode.innerText = cp ? `Match Code: ${cp}` : '';
    }
    setTimeout(() => { if (typeof vppStart === 'function') vppStart(); }, 400);
  }

  const s = localStorage.getItem('CricMax_Data');
  if (s) {
    try {
      const p = JSON.parse(s);
      currentTourn = p.currentTourn || null;
      currentTournId = p.currentTournId || null;
      tournamentsHistory = p.tournamentsHistory || [];
      savedTeams = p.savedTeams || [];
      pastMatchesLedger = p.pastMatchesLedger || [];
      bowlerTypeMap = p.bowlerTypeMap || {};
      if (p.matchConfig) matchConfig = Object.assign({}, DEFAULT_CONFIG, p.matchConfig);
      if (!isViewerMode) match = p.match || emptyMatch();
      window.match = match;
      matchCode = p.matchCode || (p.match && p.match.shareCode) || '';
      if (!match.shotLog) match.shotLog = [];
      if (!match.innings1PartnerRuns) match.innings1PartnerRuns = [];
      if (!match.innings1Fow) match.innings1Fow = [];
      if (!match.innings1SectorRuns) match.innings1SectorRuns = [0, 0, 0, 0, 0, 0, 0, 0];
      if (!match.innings2SectorRuns) match.innings2SectorRuns = [0, 0, 0, 0, 0, 0, 0, 0];
      if (typeof match._currentOverRuns !== 'number') match._currentOverRuns = 0;
      if (typeof match._lastOverRuns !== 'number') match._lastOverRuns = 0;
      updateTournamentProfileCard();
      renderPastMatchesList();
      renderTeamsList();
      renderPointsTable();
      if (match.isActive && !isViewerMode) {
        const soundBtn = document.getElementById('btnSoundToggle');
        if (soundBtn) soundBtn.style.display = 'flex';
      }
    } catch (e) {}
  }

  try {
    if (localStorage.getItem('CricMax_Theme') === 'light') document.body.classList.add('light-mode');
  } catch (e) {}

  setupBroadcast();
  syncSettingsUI();
  updateSettingsSummary();
  updateBottomNavActive('home');
  updateLiveShareBadge();
  injectClearDataPanel();
  attachWagonWheelListener();
  setTimeout(upgradeSettingsDropdowns, 300);

  if (params.get('dev') === '1' && !isViewerMode) {
    setTimeout(() => {
      if (!match.isActive && confirm('🌱 Load demo match data? (5 overs of random play)')) seedDemoMatch();
    }, 900);
  }
});

window.addEventListener('beforeunload', () => {
  if (viewerUnsubscribe) { try { viewerUnsubscribe(); } catch (e) {} }
  if (viewerCountUnsub) { try { viewerCountUnsub(); } catch (e) {} }
  if (viewerPresenceDocRef && window.fbDeleteDoc) { try { window.fbDeleteDoc(viewerPresenceDocRef); } catch (e) {} }
});

/* Keyboard shortcuts */
document.addEventListener('keydown', e => {
  if (!match.isActive || isViewerMode) return;
  const k = e.key;
  if (['0', '1', '2', '3', '4', '6'].includes(k)) {
    const r = parseInt(k, 10);
    if (r === 0) recordBall(0);
    else promptWagonWheel(r);
  } else if (k === 'w' || k === 'W') promptWicketTypeModal();
  else if (k === 'u' || k === 'U') undoDelivery();
  else if (k === 's' || k === 'S') openSettingsModal();
});

/* Auto-capitalize text inputs */
document.addEventListener('input', function (e) {
  const el = e.target;
  if (!el || !el.matches) return;
  if (!el.matches('input[type="text"], input:not([type])')) return;
  const val = el.value;
  if (!val) return;
  const newVal = autoCapitalize(val);
  if (newVal !== val) {
    const start = el.selectionStart, end = el.selectionEnd;
    el.value = newVal;
    try { el.setSelectionRange(start, end); } catch (err) {}
  }
}, true);

/* 3D viewer nav listener */
window.addEventListener('message', function (ev) {
  if (ev.data && ev.data.type === 'CM_NAV_TO') {
    const pane = ev.data.pane;
    if (['scorecard', 'analytics', 'leaderboards'].includes(pane)) {
      launchDashboard('live');
      selectSubPane(pane);
    }
  }
});

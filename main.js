/* ============================================================
   main.js — DOMContentLoaded init, keyboard shortcuts,
             canvas polyfill, cross-frame message bus,
             loading screen controller
   ============================================================
   Loaded LAST. Contains:
     1. Loading screen controller (cmSetProgress, cmHideLoader)
     2. Canvas roundRect polyfill
     3. DOMContentLoaded boot
     4. Keyboard shortcuts
     5. Auto-capitalize inputs
     6. Cross-frame message bus (viewer → app nav)
     7. Visibility resume handler
   ============================================================ */

/* ═══════════════════════════════════════════════════════════
   LOADING SCREEN CONTROLLER
   ═══════════════════════════════════════════════════════════ */
var _cmLoaderBarEl = null;
var _cmLoaderSubEl = null;
var _cmLoaderEl    = null;
var _cmLoaderDone  = false;

function cmSetProgress(pct, subText) {
  if (!_cmLoaderBarEl) _cmLoaderBarEl = document.getElementById('cm-loader-bar');
  if (!_cmLoaderSubEl) _cmLoaderSubEl = document.getElementById('cm-loader-sub');
  if (_cmLoaderBarEl)  _cmLoaderBarEl.style.width = Math.min(100, Math.max(0, pct)) + '%';
  if (subText && _cmLoaderSubEl) _cmLoaderSubEl.innerText = subText;
}

function cmHideLoader() {
  if (_cmLoaderDone) return;
  _cmLoaderDone = true;
  if (!_cmLoaderEl) _cmLoaderEl = document.getElementById('cm-loader');
  if (!_cmLoaderEl) return;
  cmSetProgress(100, 'Ready');
  setTimeout(function () {
    _cmLoaderEl.classList.add('cm-hide');
    setTimeout(function () {
      try { _cmLoaderEl.remove(); } catch (e) {}
    }, 700);
  }, 250);
}

var _cmLoadStages = [
  [10, 'Booting CricMax…'],
  [25, 'Loading tournament hub…'],
  [45, 'Warming up the pitch…'],
  [65, 'Syncing live match…'],
  [85, 'Restoring your data…'],
  [95, 'Almost there…']
];
var _cmStageIdx = 0;

function cmAdvanceStage() {
  if (_cmStageIdx >= _cmLoadStages.length) return;
  var stage = _cmLoadStages[_cmStageIdx++];
  cmSetProgress(stage[0], stage[1]);
}

/* Failsafe — force-hide after 4.5s even if boot crashes */
setTimeout(function () { if (!_cmLoaderDone) cmHideLoader(); }, 4500);

/* ═══════════════════════════════════════════════════════════
   CANVAS roundRect POLYFILL
   ═══════════════════════════════════════════════════════════ */
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

/* ═══════════════════════════════════════════════════════════
   BOOT
   ═══════════════════════════════════════════════════════════ */
window.addEventListener('DOMContentLoaded', () => {

  /* ── 0. Loading screen — start ── */
  cmSetProgress(5, 'Initializing…');
  setTimeout(cmAdvanceStage, 120);   /* → 10%  Booting        */
  setTimeout(cmAdvanceStage, 280);   /* → 25%  Loading hub    */

  /* ── 1. Inject optional UI elements (Retire btn, MOTM box, etc.) ── */
  try { injectHelpElements(); } catch (e) { console.warn('[CricMax] injectHelpElements:', e); }

  /* ── 2. Speech synthesis voice loading ── */
  if (typeof speechSynth !== 'undefined' && speechSynth) {
    try { loadSpeechVoices(); } catch (e) {}
    speechSynth.onvoiceschanged = loadSpeechVoices;
  }

  /* ── 3. Restore voice-density preference ── */
  try {
    commentaryDensity = localStorage.getItem('CricMax_VoiceDensity') || 'boundaries';
  } catch (e) {}
  const densSel = document.getElementById('cfgVoiceDensity');
  if (densSel) densSel.value = commentaryDensity;

  /* ── 4. Firebase anonymous auth (with retry until SDK ready) ── */
  function startFirebaseAuth() {
    if (!window.fbOnAuthStateChanged || !window.fbAuth) {
      setTimeout(startFirebaseAuth, 300);
      return;
    }
    window.fbOnAuthStateChanged(window.fbAuth, (user) => {
      if (user) {
        window.firebaseReady = true;
        firebaseAuthReady = true;
        cmSetProgress(90, 'Connected…');
      } else {
        window.fbSignInAnonymously(window.fbAuth)
          .catch(err => console.error("Firebase auth failed:", err));
      }
    });
  }
  startFirebaseAuth();

  /* ── 5. Viewer-mode detection ── */
  const params = new URLSearchParams(location.search);
  if (params.get('viewer') === '1') {
    isViewerMode = true;
    document.body.classList.add('viewer-mode');
    const subTitle = document.getElementById('headerSubTitle');
    if (subTitle) subTitle.innerText = '📺 Viewer Mode';

    /* Show landing overlay until first state arrives */
    const landing = document.getElementById('viewerLanding');
    const landingCode = document.getElementById('viewerLandingCode');
    if (landing) {
      landing.style.display = 'flex';
      const cp = params.get('code');
      if (landingCode) landingCode.innerText = cp ? `Match Code: ${cp}` : '';
    }

    /* Kick off the 3D viewer if available */
    setTimeout(() => {
      if (typeof vppStart === 'function') vppStart();
    }, 400);
  }

  /* ── 6. Restore saved state from localStorage ── */
  const s = localStorage.getItem('CricMax_Data');
  if (s) {
    try {
      const p = JSON.parse(s);
      currentTourn       = p.currentTourn || null;
      currentTournId     = p.currentTournId || null;
      tournamentsHistory = p.tournamentsHistory || [];
      savedTeams         = p.savedTeams || [];
      pastMatchesLedger  = p.pastMatchesLedger || [];
      bowlerTypeMap      = p.bowlerTypeMap || {};

      if (p.matchConfig) matchConfig = Object.assign({}, DEFAULT_CONFIG, p.matchConfig);

      if (!isViewerMode) match = p.match || emptyMatch();
      window.match = match;
      matchCode = p.matchCode || (p.match && p.match.shareCode) || '';

      /* Ensure new-format fields exist */
      if (!match.shotLog) match.shotLog = [];
      if (!match.innings1PartnerRuns) match.innings1PartnerRuns = [];
      if (!match.innings1Fow) match.innings1Fow = [];
      if (!match.innings1SectorRuns) match.innings1SectorRuns = [0,0,0,0,0,0,0,0];
      if (!match.innings2SectorRuns) match.innings2SectorRuns = [0,0,0,0,0,0,0,0];
      if (typeof match._currentOverRuns !== 'number') match._currentOverRuns = 0;
      if (typeof match._lastOverRuns !== 'number') match._lastOverRuns = 0;
      if (!Array.isArray(match.oversTimeline)) match.oversTimeline = [];

      updateTournamentProfileCard();
      renderPastMatchesList();
      renderTeamsList();
      renderPointsTable();

      if (match.isActive && !isViewerMode) {
        const soundBtn = document.getElementById('btnSoundToggle');
        if (soundBtn) soundBtn.style.display = 'flex';
      }
    } catch (e) {
      console.error('LocalStorage load error:', e);
    }
  }

  /* ── 7. Theme restore ── */
  try {
    if (localStorage.getItem('CricMax_Theme') === 'light') {
      document.body.classList.add('light-mode');
    }
  } catch (e) {}

  /* ── 8. Broadcast channel + Firebase subscription ── */
  try { setupBroadcast(); } catch (e) { console.warn('[CricMax] setupBroadcast:', e); }

  /* ── 9. UI summary + initial pane state ── */
  try { syncSettingsUI(); } catch (e) {}
  try { updateSettingsSummary(); } catch (e) {}
  try { updateBottomNavActive('home'); } catch (e) {}
  try { updateLiveShareBadge(); } catch (e) {}
  try { injectClearDataPanel(); } catch (e) {}

  /* ── 10. Settings dropdown upgrade (segmented → select) ── */
  setTimeout(upgradeSettingsDropdowns, 300);

  /* ── 11. Dev-mode seeder (?dev=1) ── */
  if (params.get('dev') === '1' && !isViewerMode) {
    setTimeout(() => {
      if (!match.isActive && confirm('🌱 Load demo match data? (5 overs of random play)')) {
        seedDemoMatch();
      }
    }, 900);
  }

  /* ── 12. Loading screen — finish ── */
  setTimeout(cmAdvanceStage, 200);   /* → 45%  Warming up    */
  setTimeout(cmAdvanceStage, 400);   /* → 65%  Syncing       */
  setTimeout(cmAdvanceStage, 600);   /* → 85%  Restoring     */
  setTimeout(function () { cmSetProgress(95, 'Almost there…'); }, 750);
  setTimeout(cmHideLoader, 900);

});

/* ═══════════════════════════════════════════════════════════
   CLEANUP ON UNLOAD
   ═══════════════════════════════════════════════════════════ */
window.addEventListener('beforeunload', () => {
  if (viewerUnsubscribe) {
    try { viewerUnsubscribe(); } catch (e) {}
  }
  if (viewerCountUnsub) {
    try { viewerCountUnsub(); } catch (e) {}
  }
  if (viewerPresenceDocRef && window.fbDeleteDoc) {
    try { window.fbDeleteDoc(viewerPresenceDocRef); } catch (e) {}
  }
});

/* ═══════════════════════════════════════════════════════════
   KEYBOARD SHORTCUTS
   ═══════════════════════════════════════════════════════════
   Numeric keys: 0,1,2,3,4,6 → score that many runs
   W            → open wicket modal
   U            → undo last ball
   S            → open settings modal
   R            → open Retire Batsman modal
   Esc          → close topmost modal
   ═══════════════════════════════════════════════════════════ */
document.addEventListener('keydown', e => {
  /* Ignore if typing in an input/textarea/select */
  const tag = (e.target && e.target.tagName) || '';
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  if (e.target && e.target.isContentEditable) return;

  const k = e.key;

  /* Escape closes any open modal */
  if (k === 'Escape') {
    ['wicketTypeModal','nextBatterModal','bowlerModal','retireModal',
     'settingsModal','extrasModal','moreOptionsModal','tournConfigModal',
     'teamSelectionModal','openingRolesModal','i2Modal','endInningsModal',
     'inningsBreakModal','resultModal','wideRunsModal','nbRunsModal',
     'wagonModal','tournamentPickerModal','matchPickerModal',
     'playerCareerModal'].forEach(id => {
      const el = document.getElementById(id);
      if (el && el.style.display === 'flex') el.style.display = 'none';
    });
    return;
  }

  if (!match.isActive || isViewerMode) return;

  if (['0','1','2','3','4','6'].includes(k)) {
    const r = parseInt(k, 10);
    if (r === 0) recordBall(0);
    else promptWagonWheel(r);
  } else if (k === 'w' || k === 'W') {
    promptWicketTypeModal();
  } else if (k === 'u' || k === 'U') {
    undoDelivery();
  } else if (k === 's' || k === 'S') {
    openSettingsModal();
  } else if (k === 'r' || k === 'R') {
    if (typeof openRetireModal === 'function') openRetireModal();
  }
});

/* ═══════════════════════════════════════════════════════════
   AUTO-CAPITALIZE ALL TEXT INPUTS
   ═══════════════════════════════════════════════════════════ */
document.addEventListener('input', function (e) {
  const el = e.target;
  if (!el) return;

  /* Accept INPUT and TEXTAREA elements */
  const tag = (el.tagName || '').toUpperCase();
  if (tag !== 'INPUT' && tag !== 'TEXTAREA') return;

  /* Skip inputs that must not be capitalized */
  const type = String(el.type || 'text').toLowerCase();
  const SKIP_TYPES = [
    'password','email','number','checkbox','radio','file','color','range',
    'date','time','datetime-local','month','week','hidden',
    'submit','reset','button','image'
  ];
  if (SKIP_TYPES.indexOf(type) >= 0) return;

  const val = el.value;
  if (!val) return;

  const newVal = autoCapitalize(val);
  if (newVal === val) return;   /* nothing to change → do not touch selection */

  /* Preserve caret position */
  let start = null, end = null;
  try {
    start = el.selectionStart;
    end   = el.selectionEnd;
  } catch (err) { /* some input types block selection access */ }

  el.value = newVal;

  if (start !== null && end !== null && typeof el.setSelectionRange === 'function') {
    try { el.setSelectionRange(start, end); } catch (err) {}
  }
}, true);

/* ═══════════════════════════════════════════════════════════
   3D VIEWER → MAIN APP  NAVIGATION BUS
   ═══════════════════════════════════════════════════════════ */
window.addEventListener('message', function (ev) {
  if (!ev.data || ev.data.type !== 'CM_NAV_TO') return;
  const pane = ev.data.pane;
  if (!['scorecard', 'analytics', 'leaderboards', 'live', 'summary'].includes(pane)) return;

  try {
    if (typeof launchDashboard === 'function' && typeof selectSubPane === 'function') {
      launchDashboard('live');
      selectSubPane(pane);
    }
  } catch (e) {
    console.warn('[CricMax] CM_NAV_TO failed:', e);
  }
});

/* ═══════════════════════════════════════════════════════════
   VISIBILITY RESUME HANDLER
   ═══════════════════════════════════════════════════════════ */
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  if (!match.isActive || isViewerMode) return;

  /* If the last over ended but no modal is open, prompt for bowler */
  const lastBall = match.currentOverBalls.length === 0
                && match.legalBalls > 0
                && match.legalBalls % 6 === 0;

  if (lastBall && match.previousBowler === match.currentBowler) {
    const bm = document.getElementById('bowlerModal');
    const wk = document.getElementById('wicketTypeModal');
    const nb = document.getElementById('nextBatterModal');
    const anyOpen = (bm && bm.style.display === 'flex')
                 || (wk && wk.style.display === 'flex')
                 || (nb && nb.style.display === 'flex');
    if (!anyOpen && typeof forceBowlerChangePrompt === 'function') {
      forceBowlerChangePrompt();
    }
  }
});

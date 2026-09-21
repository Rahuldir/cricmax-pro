/* ============================================================
   main.js — DOMContentLoaded init, keyboard shortcuts,
             canvas polyfill, cross-frame message bus
   ============================================================
   This file is loaded LAST. It:
     1. Applies canvas roundRect polyfill
     2. Injects all optional UI elements
     3. Loads persisted state from localStorage
     4. Starts Firebase anonymous auth
     5. Wires up viewer mode landing + subscription
     6. Registers keyboard shortcuts (0-6, W, U, S, R)
     7. Auto-capitalizes text inputs on the fly
     8. Listens for 3D-viewer navigation messages
   ============================================================ */

/* ── Canvas roundRect polyfill for older browsers ── */
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

/* ═══════════════════════════════════════════════════════════════
   BOOT
   ═══════════════════════════════════════════════════════════════ */
window.addEventListener('DOMContentLoaded', () => {

  /* ── 1. Inject optional UI elements (Retire btn, MOTM box, etc.) ── */
  injectHelpElements();

  /* ── 2. Speech synthesis voice loading ── */
  if (speechSynth) {
    loadSpeechVoices();
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
  setupBroadcast();

  /* ── 9. UI summary + initial pane state ── */
  syncSettingsUI();
  updateSettingsSummary();
  updateBottomNavActive('home');
  updateLiveShareBadge();
  injectClearDataPanel();

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
});

/* ═══════════════════════════════════════════════════════════════
   CLEANUP ON UNLOAD
   ═══════════════════════════════════════════════════════════════ */
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

/* ═══════════════════════════════════════════════════════════════
   KEYBOARD SHORTCUTS
   ═══════════════════════════════════════════════════════════════
   Numeric keys: 0,1,2,3,4,6 → score that many runs
   W            → open wicket modal
   U            → undo last ball
   S            → open settings modal
   R            → open Retire Batsman modal
   Esc          → close topmost modal
   ═══════════════════════════════════════════════════════════════ */
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

/* ═══════════════════════════════════════════════════════════════
   AUTO-CAPITALIZE ALL TEXT INPUTS
   ═══════════════════════════════════════════════════════════════ */
document.addEventListener('input', function (e) {
  const el = e.target;
  if (!el || !el.matches) return;
  if (!el.matches('input[type="text"], input:not([type])')) return;
  /* Skip password and email fields */
  const type = (el.type || 'text').toLowerCase();
  if (type === 'password' || type === 'email' || type === 'number') return;

  const val = el.value;
  if (!val) return;

  const newVal = autoCapitalize(val);
  if (newVal !== val) {
    const start = el.selectionStart;
    const end = el.selectionEnd;
    el.value = newVal;
    try { el.setSelectionRange(start, end); } catch (err) {}
  }
}, true);

/* ═══════════════════════════════════════════════════════════════
   3D VIEWER → MAIN APP  NAVIGATION BUS
   ═══════════════════════════════════════════════════════════════
   When the user taps "Card", "Stats", or "Boards" inside the
   3D viewer iframe, it posts {type:'CM_NAV_TO', pane:'scorecard'}
   and we jump to the right pane here.
   ═══════════════════════════════════════════════════════════════ */
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

/* ═══════════════════════════════════════════════════════════════
   VISIBILITY RESUME HANDLER
   ═══════════════════════════════════════════════════════════════
   If the tab was backgrounded mid-over, some browsers throttle
   setTimeouts (e.g., bowler-change modal). On resume, re-trigger
   any pending modal.
   ═══════════════════════════════════════════════════════════════ */
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

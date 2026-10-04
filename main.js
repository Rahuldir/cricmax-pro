/* ============================================================
   main.js — Boot, loading screen, keyboard, wagon attach,
             cross-frame message bus, visibility handler
   ============================================================ */

/* ═══════════════════════════════════════════════════════════
   LOADING SCREEN
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
    setTimeout(function () { try { _cmLoaderEl.remove(); } catch (e) {} }, 700);
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

  cmSetProgress(5, 'Initializing…');
  setTimeout(cmAdvanceStage, 120);
  setTimeout(cmAdvanceStage, 280);

  /* 1. Inject optional UI */
  try { injectHelpElements(); } catch (e) { console.warn('[CricMax] injectHelpElements:', e); }

  /* 2. Speech voices */
  if (typeof speechSynth !== 'undefined' && speechSynth) {
    try { loadSpeechVoices(); } catch (e) {}
    speechSynth.onvoiceschanged = loadSpeechVoices;
  }

  /* 3. Voice density */
  try { commentaryDensity = localStorage.getItem('CricMax_VoiceDensity') || 'boundaries'; } catch (e) {}
  const densSel = document.getElementById('cfgVoiceDensity');
  if (densSel) densSel.value = commentaryDensity;

  /* 4. Firebase auth */
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
        window.fbSignInAnonymously(window.fbAuth).catch(err => console.error("Firebase auth failed:", err));
      }
    });
  }
  startFirebaseAuth();

  /* 5. Viewer-mode detection */
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

  /* 6. Restore saved state from localStorage */
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

      /* ⚡ Normalize — self-heal missing fields */
      if (typeof normalizeMatch === 'function') normalizeMatch(match);

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

  /* 7. Theme restore */
  try { if (localStorage.getItem('CricMax_Theme') === 'light') document.body.classList.add('light-mode'); } catch (e) {}

  /* 8. Broadcast + Firebase subscription */
  try { setupBroadcast(); } catch (e) { console.warn('[CricMax] setupBroadcast:', e); }

  /* 9. UI summary */
  try { syncSettingsUI(); } catch (e) {}
  try { updateSettingsSummary(); } catch (e) {}
  try { updateBottomNavActive('home'); } catch (e) {}
  try { updateLiveShareBadge(); } catch (e) {}
  try { injectClearDataPanel(); } catch (e) {}

  /* 10. Settings dropdown upgrade */
  setTimeout(upgradeSettingsDropdowns, 300);

  /* 11. Attach wagon wheel listener (CRITICAL — was missing) */
  setTimeout(function () {
    try {
      if (typeof attachWagonWheelListener === 'function') {
        attachWagonWheelListener();
        console.log('[CricMax] 🕸️ Wagon wheel listener attached');
      } else {
        console.warn('[CricMax] attachWagonWheelListener not defined');
      }
    } catch (e) {
      console.error('[CricMax] Wagon wheel attach failed:', e);
    }
  }, 500);

  /* 12. Dev-mode seeder */
  if (params.get('dev') === '1' && !isViewerMode) {
    setTimeout(() => {
      if (!match.isActive && confirm('🌱 Load demo match data? (5 overs of random play)')) seedDemoMatch();
    }, 900);
  }

  /* 13. Loading screen — finish */
  setTimeout(cmAdvanceStage, 200);
  setTimeout(cmAdvanceStage, 400);
  setTimeout(cmAdvanceStage, 600);
  setTimeout(function () { cmSetProgress(95, 'Almost there…'); }, 750);
  setTimeout(cmHideLoader, 900);

});

/* ═══════════════════════════════════════════════════════════
   CLEANUP ON UNLOAD
   ═══════════════════════════════════════════════════════════ */
window.addEventListener('beforeunload', () => {
  if (viewerUnsubscribe) { try { viewerUnsubscribe(); } catch (e) {} }
  if (viewerCountUnsub)  { try { viewerCountUnsub();  } catch (e) {} }
  if (viewerPresenceDocRef && window.fbDeleteDoc) {
    try { window.fbDeleteDoc(viewerPresenceDocRef); } catch (e) {}
  }
});

/* ═══════════════════════════════════════════════════════════
   KEYBOARD SHORTCUTS
   ═══════════════════════════════════════════════════════════ */
document.addEventListener('keydown', e => {
  const tag = (e.target && e.target.tagName) || '';
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  if (e.target && e.target.isContentEditable) return;

  const k = e.key;

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

  if (!match || !match.isActive || isViewerMode) return;

  if (['0','1','2','3','4','6'].includes(k)) {
    const r = parseInt(k, 10);
    if (r === 0) recordBall(0);
    else promptWagonWheel(r);
  } else if (k === 'w' || k === 'W') promptWicketTypeModal();
  else if (k === 'u' || k === 'U') undoDelivery();
  else if (k === 's' || k === 'S') openSettingsModal();
  else if (k === 'r' || k === 'R') {
    if (typeof openRetireModal === 'function') openRetireModal();
  }
});

/* ═══════════════════════════════════════════════════════════
   AUTO-CAPITALIZE ALL TEXT INPUTS
   ═══════════════════════════════════════════════════════════ */
document.addEventListener('input', function (e) {
  const el = e.target;
  if (!el) return;
  const tag = (el.tagName || '').toUpperCase();
  if (tag !== 'INPUT' && tag !== 'TEXTAREA') return;

  const type = String(el.type || 'text').toLowerCase();
  const SKIP_TYPES = ['password','email','number','checkbox','radio','file','color','range',
    'date','time','datetime-local','month','week','hidden','submit','reset','button','image'];
  if (SKIP_TYPES.indexOf(type) >= 0) return;

  const val = el.value;
  if (!val) return;

  const newVal = autoCapitalize(val);
  if (newVal === val) return;

  let start = null, end = null;
  try { start = el.selectionStart; end = el.selectionEnd; } catch (err) {}

  el.value = newVal;

  if (start !== null && end !== null && typeof el.setSelectionRange === 'function') {
    try { el.setSelectionRange(start, end); } catch (err) {}
  }
}, true);

/* ═══════════════════════════════════════════════════════════
   3D VIEWER → MAIN APP NAVIGATION BUS
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
   VISIBILITY RESUME HANDLER — SAFE VERSION
   ═══════════════════════════════════════════════════════════ */
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  if (!match || !match.isActive || isViewerMode) return;

  /* ⚡ Normalize first — self-heal */
  if (typeof normalizeMatch === 'function') normalizeMatch(match);

  const overBalls = Array.isArray(match.currentOverBalls) ? match.currentOverBalls : [];
  const lastBall = overBalls.length === 0
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

/* ═══════════════════════════════════════════════════════════
   BACKUP COMMENTARY RENDERER (safety net)
   ═══════════════════════════════════════════════════════════ */
(function () {
  var lastLen = -1, lastFirst = '';
  function safeRender() {
    if (typeof match === 'undefined' || !match) return;
    var c = document.getElementById('commentaryContainer');
    if (!c) return;
    var arr = Array.isArray(match.commentary) ? match.commentary : [];
    var len = arr.length;
    var first = (arr[0] && arr[0].desc) ? String(arr[0].desc) : '';
    if (len === lastLen && first === lastFirst) return;
    lastLen = len; lastFirst = first;
    if (len === 0) { c.innerHTML = '<div class="empty-comm">No deliveries yet.</div>'; return; }
    var html = '';
    for (var i = 0; i < Math.min(40, arr.length); i++) {
      var comm = arr[i];
      if (!comm) continue;
      if (comm.type === 'summary') {
        html += '<div class="comm-item comm-summary' + (i === 0 ? ' newest' : '') + '">' +
                  '<span class="comm-summary-icon">📊</span>' +
                  '<div class="comm-summary-text">' + comm.desc + '</div></div>';
        continue;
      }
      var tc = comm.type === 'w' ? 'w' : comm.type === 'four' ? 'four' : comm.type === 'six' ? 'six' : '';
      html += '<div class="comm-item' + (i === 0 ? ' newest' : '') + '">' +
                '<div class="comm-ball ' + tc + '">' + comm.ball + '</div>' +
                '<div class="comm-body"><div class="comm-over">Over ' + comm.ball + '</div>' +
                '<div class="comm-text">' + comm.desc + '</div></div></div>';
    }
    c.innerHTML = html;
  }
  setInterval(safeRender, 500);
  console.log('[CricMax] 📝 Backup commentary renderer armed');
})();

/* ============================================================
   firebase.js — Realtime Database sync + viewer presence
   ✅ Writes to the SAME path viewer.html reads from:
         cricmax/matches/{matchCode}
   ✅ Self-healing: normalizeMatch() runs before every state use
   ✅ Clean viewer share URL: /viewer.html?code=XXXXXX
   ============================================================ */

function broadcastMatchState(latestShot = null) {
  try {
    if (typeof normalizeMatch === 'function') normalizeMatch(match);

    window.match = match;
    if (broadcastChannel && !isViewerMode) {
      broadcastChannel.postMessage({ type: 'match_state', match });
    }
    const f = document.getElementById('stadiumIframe') || document.querySelector('iframe');
    if (f && f.contentWindow) {
      f.contentWindow.postMessage({ type: 'SYNC_MATCH_STATE', payload: match }, '*');
      if (latestShot) {
        f.contentWindow.postMessage({ type: 'TRIGGER_DELIVERY', shot: latestShot }, '*');
      }
    }
  } catch (e) {
    console.warn('[CricMax] broadcastMatchState error:', e);
  }
}

function generateMatchCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function setupBroadcast() {
  try {
    broadcastChannel = new BroadcastChannel('cricmax_live');
    broadcastChannel.onmessage = (ev) => {
      if (isViewerMode && ev.data && ev.data.type === 'match_state') {
        applyViewerState(ev.data.match);
      }
    };
  } catch (e) {}

  const params = new URLSearchParams(location.search);
  const codeParam = params.get('code');
  if (isViewerMode && codeParam) {
    waitForFirebaseAndSubscribe(codeParam);
  }
}

function waitForFirebaseAndSubscribe(code, attempt = 0) {
  if (window.firebaseReady && typeof firebase !== 'undefined') {
    return subscribeToMatch(code);
  }
  if (attempt > 60) return showToast('Unable to connect to live feed.');
  setTimeout(() => waitForFirebaseAndSubscribe(code, attempt + 1), 500);
}

/* ─── Viewer subscription — Realtime Database ─── */
function subscribeToMatch(code) {
  if (viewerUnsubscribe) {
    try { viewerUnsubscribe(); } catch (e) {}
  }
  if (typeof firebase === 'undefined') return;
  const ref = firebase.database().ref('cricmax/matches/' + code);
  const handler = (snap) => {
    const data = snap.val();
    if (!data) return;
    const state = data.matchState || data;
    if (state) {
      if (typeof normalizeMatch === 'function') normalizeMatch(state);
      applyViewerState(state);
      showLiveViewerPulse();
    }
  };
  ref.on('value', handler);
  viewerUnsubscribe = function () {
    try { ref.off('value', handler); } catch (e) {}
  };
}

async function registerViewerPresence(code) {
  if (!window.firebaseReady || typeof firebase === 'undefined' || !code) return;
  try {
    const uid = (window.fbAuth && window.fbAuth.currentUser && window.fbAuth.currentUser.uid)
              || ('anon_' + Math.random().toString(36).slice(2, 9));
    const vref = firebase.database().ref('cricmax/matches/' + code + '/viewers/' + uid);
    viewerPresenceDocRef = vref;
    await vref.update({
      joinedAt: Date.now(),
      role: isViewerMode ? 'viewer' : 'host'
    });

    if (viewerCountUnsub) {
      try { viewerCountUnsub(); } catch (e) {}
    }
    const viewersRef = firebase.database().ref('cricmax/matches/' + code + '/viewers');
    const countHandler = (snap) => {
      const size = snap.numChildren ? snap.numChildren() : Object.keys(snap.val() || {}).length;
      const num = document.getElementById('liveViewerCountNum');
      const badge = document.getElementById('liveViewerCount');
      if (num) num.innerText = size;
      if (badge) badge.style.display = size > 0 ? 'inline-flex' : 'none';
    };
    viewersRef.on('value', countHandler);
    viewerCountUnsub = function () {
      try { viewersRef.off('value', countHandler); } catch (e) {}
    };
  } catch (e) {
    console.warn('[CricMax] registerViewerPresence failed:', e);
  }
}

/* ─── Sharing ──────────────────────────────────────────── */
function shareViewerOnly() {
  try {
    const code = (typeof matchCode !== 'undefined' && matchCode)
              || (match && match.shareCode)
              || '';
    const url = location.origin + '/viewer.html' + (code ? '?code=' + encodeURIComponent(code) : '');

    if (navigator.share) {
      navigator.share({
        title: 'CricMax Pro — Live Match',
        text:  'Watch the match live',
        url:   url
      }).catch(function () {});
      return;
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url)
        .then(() => showToast('✅ Viewer link copied!' + (code ? ' • Code: ' + code : '')))
        .catch(() => fallbackCopy(url));
    } else {
      fallbackCopy(url);
    }
  } catch (e) {
    showToast('⚠️ Unable to share.');
  }
}

function fallbackCopy(url) {
  try {
    const ta = document.createElement('textarea');
    ta.value = url;
    ta.style.cssText = 'position:fixed;left:-9999px;top:0;';
    document.body.appendChild(ta);
    ta.focus(); ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast('✅ Viewer link copied!' + (matchCode ? ' • Code: ' + matchCode : ''));
  } catch (e) {
    showToast('Link: ' + url, 5000);
  }
}

function copyCommentaryLink() { shareViewerOnly(); }

/* ─── Persistence — Realtime Database ─── */
async function autoPersist() {
  window.match = match;

  if (typeof normalizeMatch === 'function') normalizeMatch(match);

  const d = {
    currentTourn,
    currentTournId,
    tournamentsHistory,
    savedTeams,
    pastMatchesLedger,
    match,
    bowlerTypeMap,
    matchConfig,
    matchCode,
    timestamp: new Date().toISOString()
  };

  try {
    localStorage.setItem('CricMax_Data', JSON.stringify(d));
    if (matchCode) localStorage.setItem('currentMatchCode', matchCode);
  } catch (e) {
    console.warn('[CricMax] localStorage save failed:', e);
  }

  if (typeof firebase !== 'undefined' && window.firebaseReady && window.fbAuth && window.fbAuth.currentUser && matchCode) {
    clearTimeout(cloudWriteTimer);
    cloudWriteTimer = setTimeout(async () => {
      try {
        await firebase.database().ref('cricmax/matches/' + matchCode).set({
          matchState: match,
          shareCode: matchCode,
          hostUid: window.fbAuth.currentUser.uid,
          isActive: match.isActive,
          updatedAt: Date.now()
        });
        showLiveViewerPulse();
      } catch (e) {
        console.warn('[CricMax] RTDB write failed:', e);
      }
    }, 250);
  }
}

function saveMatchToLocalStorage() {
  autoPersist();
  showToast('✅ Match state saved!');
}

function loadMatchFromLocalStorage() {
  const s = localStorage.getItem('CricMax_Data');
  if (!s) return showToast('No saved data found.');

  try {
    const p = JSON.parse(s);
    currentTourn       = p.currentTourn || null;
    currentTournId     = p.currentTournId || null;
    tournamentsHistory = p.tournamentsHistory || [];
    savedTeams         = p.savedTeams || [];
    pastMatchesLedger  = p.pastMatchesLedger || [];
    bowlerTypeMap      = p.bowlerTypeMap || {};

    if (p.matchConfig) matchConfig = Object.assign({}, DEFAULT_CONFIG, p.matchConfig);

    match = p.match || emptyMatch();
    window.match = match;
    matchCode = p.matchCode || (p.match && p.match.shareCode) || '';

    try { localStorage.setItem('currentMatchCode', matchCode); } catch (e) {}

    if (typeof normalizeMatch === 'function') normalizeMatch(match);

    updateTournamentProfileCard();
    renderPastMatchesList();
    renderTeamsList();
    renderPointsTable();

    if (match.isActive) launchDashboard('live');
    else                launchDashboard('tournament');

    syncSettingsUI();
    updateSettingsSummary();
    updateLiveShareBadge();
    showToast('✅ Restored!');
  } catch (e) {
    console.error('[CricMax] loadMatchFromLocalStorage:', e);
    showToast('Failed to parse saved data.');
  }
}

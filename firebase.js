/* ============================================================
   firebase.js — Broadcast channel, Firestore sync, viewer presence
   ============================================================ */

function broadcastMatchState(latestShot = null) {
  try {
    window.match = match;
    if (broadcastChannel && !isViewerMode) broadcastChannel.postMessage({ type: 'match_state', match });
    const f = document.getElementById('stadiumIframe') || document.querySelector('iframe');
    if (f && f.contentWindow) {
      f.contentWindow.postMessage({ type: 'SYNC_MATCH_STATE', payload: match }, '*');
      if (latestShot) f.contentWindow.postMessage({ type: 'TRIGGER_DELIVERY', shot: latestShot }, '*');
    }
  } catch (e) {}
}

function generateMatchCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return code;
}

function setupBroadcast() {
  try {
    broadcastChannel = new BroadcastChannel('cricmax_live');
    broadcastChannel.onmessage = (ev) => {
      if (isViewerMode && ev.data && ev.data.type === 'match_state') applyViewerState(ev.data.match);
    };
  } catch (e) {}
  const params = new URLSearchParams(location.search);
  const codeParam = params.get('code');
  if (isViewerMode && codeParam) waitForFirebaseAndSubscribe(codeParam);
}

function waitForFirebaseAndSubscribe(code, attempt = 0) {
  if (window.firebaseReady && window.fbOnSnapshot) return subscribeToMatch(code);
  if (attempt > 60) return showToast('Unable to connect to live feed.');
  setTimeout(() => waitForFirebaseAndSubscribe(code, attempt + 1), 500);
}

function subscribeToMatch(code) {
  if (viewerUnsubscribe) { try { viewerUnsubscribe(); } catch (e) {} }
  const docRef = window.fbDoc(window.fbDb, 'matches', code);
  viewerUnsubscribe = window.fbOnSnapshot(docRef, (snap) => {
    if (!snap.exists()) return;
    const data = snap.data();
    if (data && data.matchState) {
      applyViewerState(data.matchState);
      showLiveViewerPulse();
    }
  }, err => console.error('Firestore sub error:', err));
}

async function registerViewerPresence(code) {
  if (!window.firebaseReady || !window.fbDb || !code) return;
  try {
    const uid = (window.fbAuth && window.fbAuth.currentUser && window.fbAuth.currentUser.uid)
      || ('anon_' + Math.random().toString(36).slice(2, 9));
    const vref = window.fbDoc(window.fbDb, 'matches', code, 'viewers', uid);
    viewerPresenceDocRef = vref;
    await window.fbSetDoc(vref, { joinedAt: Date.now(), role: isViewerMode ? 'viewer' : 'host' }, { merge: true });
    if (viewerCountUnsub) { try { viewerCountUnsub(); } catch (e) {} }
    const colRef = window.fbCollection(window.fbDb, 'matches', code, 'viewers');
    viewerCountUnsub = window.fbOnSnapshot(colRef, snap => {
      const num = document.getElementById('liveViewerCountNum');
      const badge = document.getElementById('liveViewerCount');
      const size = snap.size;
      if (num) num.innerText = size;
      if (badge) badge.style.display = size > 0 ? 'inline-flex' : 'none';
    }, err => console.warn('Viewer count error:', err));
  } catch (e) {}
}

/* Sharing */
function shareViewerOnly() {
  try {
    let url = location.origin + location.pathname + '?viewer=1';
    if (matchCode) url += '&code=' + matchCode;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url)
        .then(() => showToast('✅ Viewer link copied!' + (matchCode ? ' • Code: ' + matchCode : '')))
        .catch(() => fallbackCopy(url));
    } else fallbackCopy(url);
  } catch (e) { showToast('⚠️ Unable to share.'); }
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
  } catch (e) { showToast('Link: ' + url, 5000); }
}

function copyCommentaryLink() { shareViewerOnly(); }

/* Persistence */
async function autoPersist() {
  window.match = match;
  const d = {
    currentTourn, currentTournId, tournamentsHistory, savedTeams, pastMatchesLedger,
    match, bowlerTypeMap, matchConfig, matchCode,
    timestamp: new Date().toISOString()
  };
  try { localStorage.setItem('CricMax_Data', JSON.stringify(d)); } catch (e) {}

  if (window.firebaseReady && window.fbAuth && window.fbAuth.currentUser && matchCode) {
    clearTimeout(cloudWriteTimer);
    cloudWriteTimer = setTimeout(async () => {
      try {
        const docRef = window.fbDoc(window.fbDb, 'matches', matchCode);
        await window.fbSetDoc(docRef, {
          matchState: match,
          shareCode: matchCode,
          hostUid: window.fbAuth.currentUser.uid,
          isActive: match.isActive,
          updatedAt: new Date().toISOString()
        });
        showLiveViewerPulse();
      } catch (e) {}
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
    currentTourn = p.currentTourn || null;
    currentTournId = p.currentTournId || null;
    tournamentsHistory = p.tournamentsHistory || [];
    savedTeams = p.savedTeams || [];
    pastMatchesLedger = p.pastMatchesLedger || [];
    bowlerTypeMap = p.bowlerTypeMap || {};
    if (p.matchConfig) matchConfig = Object.assign({}, DEFAULT_CONFIG, p.matchConfig);
    match = p.match || emptyMatch();
    window.match = match;
    matchCode = p.matchCode || (p.match && p.match.shareCode) || '';
    if (!match.shotLog) match.shotLog = [];
    if (!match.innings1SectorRuns) match.innings1SectorRuns = [0, 0, 0, 0, 0, 0, 0, 0];
    if (!match.innings2SectorRuns) match.innings2SectorRuns = [0, 0, 0, 0, 0, 0, 0, 0];
    updateTournamentProfileCard();
    renderPastMatchesList();
    renderTeamsList();
    renderPointsTable();
    if (match.isActive) launchDashboard('live'); else launchDashboard('tournament');
    syncSettingsUI();
    updateSettingsSummary();
    updateLiveShareBadge();
    showToast('✅ Restored!');
  } catch (e) { showToast('Failed to parse saved data.'); }
}

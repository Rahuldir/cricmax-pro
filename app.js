/* ============================================================
   CricMax Pro — Unified & Responsive Main Application Logic
   ============================================================ */

/* ============ APPLICATION STATE ============ */
let savedTeams = [];
let currentTourn = null;
let currentTournId = null;
let tournamentsHistory = [];
let pastMatchesLedger = [];
let selectedTeam1 = { name: "", squad: [] };
let selectedTeam2 = { name: "", squad: [] };
let historyStack = [];
let pendingRuns = 0;

let isCommentaryVoiceActive = false;
let speechSynth = window.speechSynthesis || null;
let preferredVoice = null;
let speechVoicesReady = false;
let usedPhrases = {};
let isViewerMode = false;
let broadcastChannel = null;

let RESOLVED_TEAM_1 = '';
let RESOLVED_TEAM_2 = '';
let bowlerTypeMap = {};
let currentStatsCategory = 'mvp';
let flashTimer = null;
let inningsTransitionLock = false;
let matchCode = '';
let viewerUnsubscribe = null;
let cloudWriteTimer = null;
let firebaseAuthReady = false;

const DEFAULT_CONFIG = {
  wideRuns: 1,
  wideCountsAsBall: false,
  nbRuns: 1,
  autoFreeHitOnNB: true,
  byeRunsDefault: 1,
  legByeRunsDefault: 1,
  maxOversPerBowler: 0,
  autoDetectStumpings: true,
  forceFreeHit: false
};

let matchConfig = Object.assign({}, DEFAULT_CONFIG);
let nzcRunChartMode = 'manhattan';
let nzcWagonMode = 'wagon';
let nzcWagonInnings = 1;

function emptyMatch() {
  return {
    isActive: false,
    innings: 1,
    totalOvers: 20,
    originalOvers: 20,
    venue: "",
    target: 0,
    teamBatting: "",
    teamBattingAbbr: "",
    teamBowling: "",
    teamBowlingAbbr: "",
    runs: 0,
    wickets: 0,
    legalBalls: 0,
    striker: "",
    nonStriker: "",
    currentBowler: "",
    previousBowler: "",
    batters: {},
    bowlers: {},
    fielding: {},
    playerTeamMap: {},
    recentBalls: [],
    commentary: [],
    fow: [],
    oversTimeline: [],
    sectorRuns: [0, 0, 0, 0, 0, 0, 0, 0],
    cumulativeWorm: [0],
    currentOverBalls: [],
    isFreeHit: false,
    partnerRuns: [],
    currentPartnership: { runs: 0, balls: 0, batters: [] },
    innings1Score: null,
    lastBowlerWkts: [],
    shotLog: [],
    innings1PartnerRuns: [],
    innings1Fow: [],
    innings1SectorRuns: [0, 0, 0, 0, 0, 0, 0, 0],
    innings2SectorRuns: [0, 0, 0, 0, 0, 0, 0, 0],
    innings1BattingSnapshot: null,
    innings1BowlingSnapshot: null,
    innings1FieldingSnapshot: null
  };
}

let match = emptyMatch();
window.match = match;

/* ============ RESPONSIVE TOAST ============ */
function showToast(msg, duration = 2600) {
  let toast = document.getElementById('globalToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'globalToast';
    toast.style.cssText = 'position:fixed;bottom:105px;left:50%;transform:translateX(-50%) translateY(30px);background:linear-gradient(135deg,rgba(0,146,112,.97),rgba(0,230,118,.97));color:#fff;padding:12px 24px;border-radius:14px;font-size:12.5px;font-weight:800;z-index:9999999;box-shadow:0 10px 40px rgba(0,0,0,.65),0 0 30px rgba(0,230,118,.4);max-width:90vw;text-align:center;opacity:0;transition:all .35s cubic-bezier(.175,.885,.32,1.275);pointer-events:none;backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,.3);word-break:break-word;';
    document.body.appendChild(toast);
  }
  toast.innerText = msg;
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(-50%) translateY(0)';
  });
  clearTimeout(toast._hideTimer);
  toast._hideTimer = setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(30px)';
  }, duration);
}

/* ============ TEXT-TO-SPEECH COMMENTARY ============ */
function loadSpeechVoices() {
  if (!speechSynth) return;
  try {
    const voices = speechSynth.getVoices();
    if (!voices || voices.length === 0) return;
    preferredVoice = voices.find(v => v.lang === 'en-IN') ||
      voices.find(v => v.lang === 'en-GB') ||
      voices.find(v => v.lang === 'en-US') ||
      voices.find(v => v.lang && v.lang.toLowerCase().startsWith('en')) ||
      voices[0];
    speechVoicesReady = true;
  } catch (e) {}
}

function primeSpeech() {
  if (!speechSynth) speechSynth = window.speechSynthesis;
  if (!speechSynth) return;
  if (!speechVoicesReady) loadSpeechVoices();
  try {
    const warm = new SpeechSynthesisUtterance(' ');
    warm.volume = 0;
    warm.rate = 2;
    speechSynth.speak(warm);
  } catch (e) {}
}

function speak(text) {
  if (!isCommentaryVoiceActive || !text || !text.trim()) return;
  if (!speechSynth) speechSynth = window.speechSynthesis;
  if (!speechSynth) return;
  try {
    if (!speechVoicesReady) loadSpeechVoices();
    if (speechSynth.speaking && speechSynth.pending) {
      try { speechSynth.cancel(); } catch (e) {}
      setTimeout(() => doSpeak(text), 90);
    } else {
      doSpeak(text);
    }
  } catch (e) {
    console.error('speak() error:', e);
  }
}

function doSpeak(text) {
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.05;
    u.pitch = 1.0;
    u.volume = 1.0;
    u.lang = 'en-IN';
    if (preferredVoice) u.voice = preferredVoice;
    speechSynth.speak(u);
  } catch (e) {
    console.error('doSpeak error:', e);
  }
}

function toggleCommentaryVoice() {
  isCommentaryVoiceActive = !isCommentaryVoiceActive;
  const b = document.getElementById('btnSoundToggle');
  const icon = document.getElementById('soundIcon');
  const vppIcon = document.getElementById('vppSoundIcon');
  const vppBtn = document.getElementById('vppSoundToggle');

  if (isCommentaryVoiceActive) {
    if (b) b.classList.add('active');
    if (icon) icon.innerText = '🔊';
    if (vppBtn) vppBtn.classList.add('active');
    if (vppIcon) vppIcon.innerText = '🔊';
    primeSpeech();
    setTimeout(() => {
      const team = match.teamBatting || 'the batting side';
      const ovStr = `${Math.floor(match.legalBalls / 6)}.${match.legalBalls % 6}`;
      const greeting = match.isActive
        ? `Commentary enabled. ${team} are ${match.runs} for ${match.wickets} in ${ovStr} overs.`
        : 'Commentary enabled.';
      speak(greeting);
    }, 150);
  } else {
    if (b) b.classList.remove('active');
    if (icon) icon.innerText = '🔇';
    if (vppBtn) vppBtn.classList.remove('active');
    if (vppIcon) vppIcon.innerText = '🔇';
    if (speechSynth) { try { speechSynth.cancel(); } catch (e) {} }
  }
}

/* ============ INITIALIZATION ============ */
window.addEventListener('DOMContentLoaded', () => {
  if (speechSynth) {
    loadSpeechVoices();
    speechSynth.onvoiceschanged = loadSpeechVoices;
  }

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
        window.fbSignInAnonymously(window.fbAuth).catch(err => console.error("Firebase auth failed:", err));
      }
    });
  }
  startFirebaseAuth();

  const params = new URLSearchParams(location.search);
  if (params.get('viewer') === '1') {
    isViewerMode = true;
    document.body.classList.add('viewer-mode');
    const subTitle = document.getElementById('headerSubTitle');
    if (subTitle) subTitle.innerText = '📺 Viewer Mode';
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

  try {
    if (localStorage.getItem('CricMax_Theme') === 'light') {
      document.body.classList.add('light-mode');
    }
  } catch (e) {}

  setupBroadcast();
  syncSettingsUI();
  updateSettingsSummary();
  updateBottomNavActive('home');
  updateLiveShareBadge();
});

window.addEventListener('beforeunload', () => {
  if (viewerUnsubscribe) {
    try { viewerUnsubscribe(); } catch (e) {}
  }
});

/* ============ INTERCONNECTED BROADCAST & 3D STADIUM SYNC ============ */
function broadcastMatchState(latestShot = null) {
  try {
    window.match = match;
    if (broadcastChannel && !isViewerMode) {
      broadcastChannel.postMessage({ type: 'match_state', match: match });
    }

    // Interconnect directly with the 3D Stadium iframe if present
    const stadiumFrame = document.getElementById('stadiumIframe') || document.querySelector('iframe');
    if (stadiumFrame && stadiumFrame.contentWindow) {
      stadiumFrame.contentWindow.postMessage({
        type: 'SYNC_MATCH_STATE',
        payload: match
      }, '*');

      if (latestShot) {
        stadiumFrame.contentWindow.postMessage({
          type: 'TRIGGER_DELIVERY',
          shot: latestShot
        }, '*');
      }
    }
  } catch (e) {
    console.warn('broadcastMatchState error:', e);
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

/* ============ TOURNAMENT ARCHIVE ============ */
function archiveCurrentTournament() {
  if (!currentTourn) return;
  if (!currentTournId) currentTournId = 't_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
  const snapshot = {
    id: currentTournId,
    name: currentTourn.name,
    overs: currentTourn.overs,
    venue: currentTourn.venue,
    teams: JSON.parse(JSON.stringify(savedTeams || [])),
    pastMatches: JSON.parse(JSON.stringify(pastMatchesLedger || [])),
    currentMatch: (match && match.isActive) ? JSON.parse(JSON.stringify(match)) : null,
    matchCode: matchCode || '',
    savedAt: new Date().toISOString()
  };
  const idx = tournamentsHistory.findIndex(t => t.id === currentTournId);
  if (idx >= 0) tournamentsHistory[idx] = snapshot;
  else tournamentsHistory.push(snapshot);
  autoPersist();
}

function openTournamentPicker() {
  const listEl = document.getElementById('pastTournamentsList');
  if (!listEl) return;
  listEl.innerHTML = '';
  const list = [...tournamentsHistory];
  if (currentTourn && currentTournId && !list.find(t => t.id === currentTournId)) {
    list.push({
      id: currentTournId,
      name: currentTourn.name,
      overs: currentTourn.overs,
      venue: currentTourn.venue,
      savedAt: new Date().toISOString()
    });
  }

  if (list.length === 0) {
    listEl.innerHTML = '<div style="text-align:center;color:var(--muted);font-size:12px;padding:20px;font-style:italic;">No previous tournaments yet</div>';
  } else {
    list.sort((a, b) => new Date(b.savedAt || 0) - new Date(a.savedAt || 0));
    let html = '<div style="font-size:11px;color:var(--muted);text-transform:uppercase;font-weight:800;margin-bottom:8px;">Resume Previous</div>';
    list.forEach(t => {
      const isActive = t.id === currentTournId;
      const matchInfo = (t.id === currentTournId && match && match.isActive)
        ? ' • <span style="color:var(--green);font-weight:900;">MATCH IN PROGRESS</span>'
        : '';
      html += `<div class="tourn-list-item${isActive ? ' active' : ''}" onclick="resumeTournament('${t.id}')">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
          <div style="font-size:14px;font-weight:900;color:#fff;">${t.name}</div>
          ${isActive ? '<span style="font-size:9px;background:var(--green);color:#0a0e1a;padding:2px 7px;border-radius:8px;font-weight:900;">ACTIVE</span>' : ''}
        </div>
        <div style="font-size:10.5px;color:var(--muted);margin-top:4px;">
          ${t.overs} overs • ${t.venue || 'Venue'}${t.savedAt ? ' • ' + new Date(t.savedAt).toLocaleDateString() : ''}${matchInfo}
        </div>
      </div>`;
    });
    listEl.innerHTML = html;
  }
  document.getElementById('tournamentPickerModal').style.display = 'flex';
}

function startNewTournamentFlow() {
  archiveCurrentTournament();
  currentTourn = null;
  currentTournId = null;
  savedTeams = [];
  pastMatchesLedger = [];
  match = emptyMatch();
  window.match = match;
  matchCode = '';
  document.getElementById('tNameInput').value = '';
  document.getElementById('tOversInput').value = '20';
  document.getElementById('tVenueInput').value = '';
  autoPersist();
  openTournamentModal();
}

function resumeTournament(id) {
  closeModal('tournamentPickerModal');
  if (id === currentTournId) {
    launchDashboard('tournament');
    return;
  }
  archiveCurrentTournament();
  const t = tournamentsHistory.find(x => x.id === id);
  if (!t) {
    showToast('Tournament not found');
    return;
  }
  currentTourn = { name: t.name, overs: t.overs, venue: t.venue };
  currentTournId = t.id;
  savedTeams = JSON.parse(JSON.stringify(t.teams || []));
  pastMatchesLedger = JSON.parse(JSON.stringify(t.pastMatches || []));
  if (t.currentMatch && t.currentMatch.isActive) {
    match = t.currentMatch;
    matchCode = t.matchCode || '';
  } else {
    match = emptyMatch();
    match.totalOvers = t.overs || 20;
    match.originalOvers = t.overs || 20;
    match.venue = t.venue || '';
    matchCode = '';
  }
  window.match = match;
  autoPersist();
  launchDashboard('tournament');
  showToast('▶ Resumed: ' + t.name);
}

function openMatchPicker() {
  const resumeBtn = document.getElementById('btnResumeMatchFromHome');
  const hint = document.getElementById('matchPickerHint');
  if (match && match.isActive) {
    resumeBtn.style.display = 'block';
    resumeBtn.innerHTML = `▶ Resume: ${match.teamBatting || '?'} vs ${match.teamBowling || '?'}`;
    if (hint) hint.innerText = 'A match is currently in progress';
  } else {
    resumeBtn.style.display = 'none';
    if (hint) hint.innerText = currentTourn ? `Tournament: ${currentTourn.name}` : 'No tournament set up yet';
  }
  document.getElementById('matchPickerModal').style.display = 'flex';
}

function startNewMatchFromHome() {
  if (!currentTourn) {
    if (confirm('You need a tournament to start a match.\n\nCreate one now?')) {
      openTournamentPicker();
    }
    return;
  }
  if (match && match.isActive) {
    if (!confirm('A match is already in progress.\n\nStart a NEW match?')) return;
  }
  launchDashboard('tournament');
  openTeamSelectionModal();
}

function resumeMatchFromHome() {
  if (!match || !match.isActive) {
    showToast('No match in progress');
    return;
  }
  launchDashboard('live');
}

/* ============ LIVE SHARE BADGE ============ */
function updateLiveShareBadge() {
  const badge = document.getElementById('liveShareBadge');
  const codeEl = document.getElementById('liveShareCodeText');
  if (!badge || !codeEl) return;
  if (matchCode && match.isActive && !isViewerMode) {
    badge.style.display = 'inline-flex';
    codeEl.innerText = matchCode;
  } else {
    badge.style.display = 'none';
  }
}

function showLiveViewerPulse() {
  const el = document.getElementById('liveViewerPulse');
  if (!el) return;
  el.style.opacity = '1';
  clearTimeout(window._viewerPulseTimer);
  window._viewerPulseTimer = setTimeout(() => { el.style.opacity = '.35'; }, 400);
}

/* ============ BOTTOM NAVIGATION ============ */
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
  if (action === 'more') {
    openMoreOptionsModal();
    return;
  }
  if (isOnHomePage()) {
    if (action === 'live') {
      if (match.isActive) launchDashboard('live');
      else openMatchPicker();
    } else {
      launchDashboard(action);
    }
  } else {
    selectSubPane(action);
  }
}

/* ============ BROADCAST & FIREBASE SETUP ============ */
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
  if (window.firebaseReady && window.fbOnSnapshot) {
    subscribeToMatch(code);
    return;
  }
  if (attempt > 60) {
    showToast('Unable to connect to live feed.');
    return;
  }
  setTimeout(() => waitForFirebaseAndSubscribe(code, attempt + 1), 500);
}

function subscribeToMatch(code) {
  if (viewerUnsubscribe) {
    try { viewerUnsubscribe(); } catch (e) {}
  }
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

function applyViewerState(newMatch) {
  if (!newMatch || !newMatch.teamBatting) return;
  match = newMatch;
  window.match = match;

  if (!match.shotLog) match.shotLog = [];
  if (!match.innings1PartnerRuns) match.innings1PartnerRuns = [];
  if (!match.innings1Fow) match.innings1Fow = [];
  if (!match.innings1SectorRuns) match.innings1SectorRuns = [0, 0, 0, 0, 0, 0, 0, 0];
  if (!match.innings2SectorRuns) match.innings2SectorRuns = [0, 0, 0, 0, 0, 0, 0, 0];

  const homeView = document.getElementById('view-home');
  const dashView = document.getElementById('view-dashboard');
  if (homeView && homeView.style.display !== 'none') {
    homeView.style.display = 'none';
    if (dashView) dashView.style.display = 'block';
  }

  const hTitle = document.getElementById('headerMainTitle');
  const hSub = document.getElementById('headerSubTitle');
  if (hTitle) hTitle.innerText = `${match.teamBatting} vs ${match.teamBowling}`;
  if (hSub) hSub.innerText = `📺 LIVE • ${match.venue} • Innings ${match.innings}`;

  renderLive();
  renderCommentary();
  renderScorecard();
  updateLiveShareBadge();
}

/* ============ SHARING ============ */
function shareViewerOnly() {
  try {
    let url = location.origin + location.pathname + '?viewer=1';
    if (matchCode) url += '&code=' + matchCode;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url)
        .then(() => showToast('✅ Viewer link copied!' + (matchCode ? ' • Code: ' + matchCode : '')))
        .catch(() => fallbackCopy(url));
    } else fallbackCopy(url);
  } catch (e) {
    showToast('⚠️ Unable to share.');
  }
}

function fallbackCopy(url) {
  try {
    const ta = document.createElement('textarea');
    ta.value = url;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    ta.style.top = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast('✅ Viewer link copied!' + (matchCode ? ' • Code: ' + matchCode : ''));
  } catch (e) {
    showToast('Link: ' + url, 5000);
  }
}

function copyCommentaryLink() {
  shareViewerOnly();
}

/* ============ PERSISTENCE ============ */
async function autoPersist() {
  window.match = match;
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
  } catch (e) {}

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
      } catch (e) {
        console.warn('Firestore write failed:', e);
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

    if (match.isActive) launchDashboard('live');
    else launchDashboard('tournament');

    syncSettingsUI();
    updateSettingsSummary();
    updateLiveShareBadge();
    showToast('✅ Restored!');
  } catch (e) {
    showToast('Failed to parse saved data.');
  }
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

function saveSettingsAndClose() {
  autoPersist();
  closeModal('settingsModal');
  updateSettingsSummary();
}

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
  match.runs += runs;
  const ovStr = `${Math.floor(match.legalBalls / 6)}.${match.legalBalls % 6}`;
  match.commentary.unshift({
    ball: ovStr,
    desc: `${runs} penalty runs awarded to ${teamName}.`,
    type: 'normal'
  });
  autoPersist();
  renderLive();
  renderCommentary();
  broadcastMatchState();
  if (isCommentaryVoiceActive) speak(`${runs} penalty runs awarded to ${teamName}.`);
  closeModal('extrasModal');
}

function retireBatter(mode) {
  if (!match.isActive || isViewerMode) return;
  const who = mode.includes('Striker') ? 'striker' : 'nonStriker';
  const name = match[who];
  if (!name || !match.batters[name]) return;

  match.batters[name].status = mode;
  const next = prompt(`Retire ${name} as "${mode}". Enter new batter name:`, '');
  if (next && next.trim()) {
    const n = autoCapitalize(next.trim());
    if (!match.batters[n]) {
      match.batters[n] = { runs: 0, balls: 0, fours: 0, sixes: 0, dots: 0, fifties: 0, hundreds: 0, status: "batting" };
      match.playerTeamMap[n] = match.teamBattingAbbr;
      autoAddPlayerToTeam(n, match.teamBatting);
    } else {
      match.batters[n].status = 'batting';
    }
    match[who] = n;
    autoPersist();
    renderLive();
    renderScorecard();
    broadcastMatchState();
    if (isCommentaryVoiceActive) speak(`${name} retired. ${n} comes to the crease.`);
  }
  closeModal('extrasModal');
}

/* ============ THEME / TV ============ */
function toggleTheme() {
  document.body.classList.toggle('light-mode');
  const l = document.body.classList.contains('light-mode');
  try { localStorage.setItem('CricMax_Theme', l ? 'light' : 'dark'); } catch (e) {}
}

function toggleTVMode() {
  const tv = document.getElementById('tvMode');
  if (!tv) return;
  tv.classList.toggle('active');
  if (tv.classList.contains('active')) renderTVMode();
}

function renderTVMode() {
  if (!match.isActive) return;
  const tTeam = document.getElementById('tvTeams');
  const tScore = document.getElementById('tvScore');
  const tMeta = document.getElementById('tvMeta');
  const tBat = document.getElementById('tvBatters');
  const r = document.getElementById('tvRecent');

  if (tTeam) tTeam.innerText = `${match.teamBatting} vs ${match.teamBowling}`;
  if (tScore) tScore.innerText = `${match.runs}/${match.wickets}`;

  const ov = `${Math.floor(match.legalBalls / 6)}.${match.legalBalls % 6}`;
  const crr = match.legalBalls > 0 ? (match.runs / (match.legalBalls / 6)).toFixed(2) : '0.00';
  if (tMeta) tMeta.innerHTML = `Overs: <b style="color:#22d3ee;">${ov}</b> / ${match.totalOvers} • CRR: <b style="color:#22d3ee;">${crr}</b>`;

  const s = match.batters[match.striker] || { runs: 0, balls: 0 };
  const ns = match.batters[match.nonStriker] || { runs: 0, balls: 0 };
  if (tBat) tBat.innerHTML = `<span>🏏 <b style="color:#00e676;">${match.striker}*</b> ${s.runs}(${s.balls})</span><span>${match.nonStriker} ${ns.runs}(${ns.balls})</span>`;

  if (r) {
    r.innerHTML = '';
    match.recentBalls.slice(-8).forEach(b => {
      const d = document.createElement('div');
      d.className = 'ball-pill ' + (b === '4' ? 'c-4' : b === '6' ? 'c-6' : b === 'W' ? 'c-w' : '');
      d.style.width = '60px';
      d.style.height = '60px';
      d.style.fontSize = '22px';
      d.textContent = b;
      r.appendChild(d);
    });
  }
}

/* ============ HELPERS ============ */
function autoCapitalize(s) {
  if (!s) return '';
  return s.replace(/(^|\s|[\-'])\S/g, matchChar => matchChar.toUpperCase());
}

function autoAddPlayerToTeam(playerName, teamName) {
  if (!playerName || !teamName) return;
  playerName = autoCapitalize(playerName.trim());
  if (!playerName) return;
  const t = savedTeams.find(x => x.name === teamName);
  if (!t) return;
  if (!t.squad) t.squad = [];
  if (!t.squad.includes(playerName)) {
    t.squad.push(playerName);
    autoPersist();
  }
}

function detectBowlerType(name) {
  if (!name) return 'pace';
  if (bowlerTypeMap[name]) return bowlerTypeMap[name];
  const lower = name.toLowerCase();
  const spinKeywords = ['spin', 'ashwin', 'jadeja', 'chahal', 'kuldeep', 'rashid', 'tahir', 'zampa', 'shakib', 'moeen', 'lyon', 'herath', 'sodhi', 'santner', 'swepson', 'parkinson', 'bishnoi', 'chakaravarthy', 'axar', 'sundar', 'hooda', 'markram', 'maxwell', 'root', 'shah', 'mujeeb', 'noor', 'hasaranga', 'theekshana', 'wellalage'];
  for (const k of spinKeywords) {
    if (lower.includes(k)) return 'spin';
  }
  return 'pace';
}

/* ============ NAVIGATION PANE SWITCHING ============ */
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
  }
  if (paneId === 'teams') renderTeamsList();
  if (paneId === 'live') {
    renderLive();
    renderCommentary();
    updateSettingsSummary();
    updateLiveShareBadge();
  }
  if (paneId === 'summary') renderSummary();
  if (paneId === 'analytics') renderNzcAnalytics();
  if (paneId === 'leaderboards') renderStatsCategory(currentStatsCategory);

  if (['live', 'scorecard', 'analytics', 'leaderboards'].includes(paneId)) {
    updateBottomNavActive(paneId);
  } else {
    updateBottomNavActive(null);
  }
}

function openMoreOptionsModal() {
  document.getElementById('moreOptionsModal').style.display = 'flex';
}

function closeModal(id) {
  if (id === 'wagonModal') {
    clearTimeout(window._wagonTimer);
    pendingRuns = 0;
  }
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

/* ============ TOURNAMENT MGMT ============ */
function updateTournamentProfileCard() {
  const nameDisplay = document.getElementById('tournNameDisplay');
  const metaDisplay = document.getElementById('tournMetaDisplay');
  if (currentTourn) {
    if (nameDisplay) nameDisplay.innerText = currentTourn.name;
    if (metaDisplay) metaDisplay.innerText = `${currentTourn.overs} Overs • ${currentTourn.venue}`;
  } else {
    if (nameDisplay) nameDisplay.innerText = "Tournament Not Set";
    if (metaDisplay) metaDisplay.innerText = "Tap Edit to configure";
  }
  updateContinueButton();
}

function updateContinueButton() {
  const btn = document.getElementById('btnContinueTourn');
  const nb = document.getElementById('btnStartNewMatch');
  const hint = document.getElementById('continueHint');
  if (!btn) return;
  const hasIncomplete = match.isActive === true;
  if (hasIncomplete) {
    btn.disabled = false;
    btn.style.opacity = '1';
    btn.style.cursor = 'pointer';
    if (nb) {
      nb.disabled = true;
      nb.style.opacity = '0.35';
      nb.style.cursor = 'not-allowed';
    }
    if (hint) hint.innerText = '▶ Resume match in progress';
  } else {
    btn.disabled = true;
    btn.style.opacity = '0.35';
    btn.style.cursor = 'not-allowed';
    if (nb) {
      nb.disabled = false;
      nb.style.opacity = '1';
      nb.style.cursor = 'pointer';
    }
    if (hint) hint.innerText = currentTourn ? 'No match in progress — start a new match' : 'Set up the tournament first, then start a new match';
  }
}

function continueFromTournament() {
  if (match.isActive) {
    launchDashboard('live');
    return;
  }
  startNewMatchFlow();
}

function startNewMatchFlow() {
  if (match.isActive) {
    if (!confirm('A match is already in progress.\n\nStart a NEW match?')) return;
  }
  launchDashboard('tournament');
  if (!currentTourn) {
    openTournamentModal();
    return;
  }
  openTeamSelectionModal();
}

function openTeamSelectionModal() {
  const i1 = document.getElementById('t1NewInput'); if (i1) i1.value = '';
  const i2 = document.getElementById('t2NewInput'); if (i2) i2.value = '';
  const dd1 = document.getElementById('t1Dropdown');
  const dd2 = document.getElementById('t2Dropdown');
  let opts = '<option value="">-- Select from saved teams --</option>';
  if (savedTeams && savedTeams.length > 0) {
    savedTeams.forEach(t => { opts += `<option value="${t.name}">${t.name}</option>`; });
  } else {
    opts = '<option value="">-- No saved teams — type below --</option>';
  }
  if (dd1) dd1.innerHTML = opts;
  if (dd2) dd2.innerHTML = opts;
  updateTeamPreview();
  document.getElementById('teamSelectionModal').style.display = 'flex';
}

function onTeamDropdownChange(num) {
  const input = document.getElementById('t' + num + 'NewInput');
  if (input) input.value = '';
  updateTeamPreview();
}

function onNewTeamInput(num) {
  const dd = document.getElementById('t' + num + 'Dropdown');
  if (dd) dd.value = '';
  updateTeamPreview();
}

function updateTeamPreview() {
  const dd1 = document.getElementById('t1Dropdown'), dd2 = document.getElementById('t2Dropdown');
  const i1 = document.getElementById('t1NewInput'), i2 = document.getElementById('t2NewInput');
  const t1 = (i1 && i1.value.trim()) || (dd1 && dd1.value) || '--';
  const t2 = (i2 && i2.value.trim()) || (dd2 && dd2.value) || '--';
  const p = document.getElementById('teamPreview');
  if (p) p.innerText = t1 + '  vs  ' + t2;
}

function openTournamentModal() {
  if (currentTourn) {
    document.getElementById('tNameInput').value = currentTourn.name || '';
    document.getElementById('tOversInput').value = currentTourn.overs || 20;
    document.getElementById('tVenueInput').value = currentTourn.venue || '';
  }
  document.getElementById('tournConfigModal').style.display = 'flex';
}

function saveTournamentAndProceed() {
  const name = document.getElementById('tNameInput').value.trim() || "Championship Cup";
  const overs = parseInt(document.getElementById('tOversInput').value, 10) || 20;
  const venue = document.getElementById('tVenueInput').value.trim() || "Local Stadium";
  const isNew = !currentTourn || !currentTournId;
  currentTourn = { name, overs, venue };
  if (isNew) {
    currentTournId = 't_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
  }
  updateTournamentProfileCard();
  closeModal('tournConfigModal');
  autoPersist();
  openTeamSelectionModal();
}

function proceedToOpenersPopupDirectly() {
  const t1New = document.getElementById('t1NewInput'), t2New = document.getElementById('t2NewInput');
  const t1DD = document.getElementById('t1Dropdown'), t2DD = document.getElementById('t2Dropdown');
  const t1 = autoCapitalize(((t1New && t1New.value.trim()) || (t1DD && t1DD.value) || '').trim());
  const t2 = autoCapitalize(((t2New && t2New.value.trim()) || (t2DD && t2DD.value) || '').trim());

  if (!t1 || !t2) {
    alert("Please enter both team names");
    return;
  }
  if (t1.toLowerCase() === t2.toLowerCase()) {
    alert("Teams must be different");
    return;
  }

  RESOLVED_TEAM_1 = t1;
  RESOLVED_TEAM_2 = t2;
  let team1 = savedTeams.find(x => x.name === t1);
  if (!team1) { team1 = { name: t1, squad: [] }; savedTeams.push(team1); }
  let team2 = savedTeams.find(x => x.name === t2);
  if (!team2) { team2 = { name: t2, squad: [] }; savedTeams.push(team2); }

  selectedTeam1 = team1;
  selectedTeam2 = team2;
  closeModal('teamSelectionModal');

  const b = document.getElementById('battingTeamSelect');
  b.innerHTML = `<option value="${RESOLVED_TEAM_1}">${RESOLVED_TEAM_1}</option><option value="${RESOLVED_TEAM_2}">${RESOLVED_TEAM_2}</option>`;
  document.getElementById('strikerCustom').value = '';
  document.getElementById('nonStrikerCustom').value = '';
  document.getElementById('bowlerCustom').value = '';

  populatePlayerDropdowns();
  document.getElementById('openingRolesModal').style.display = 'flex';
  autoPersist();
}

function populatePlayerDropdowns() {
  const bn = document.getElementById('battingTeamSelect').value;
  const wn = bn === RESOLVED_TEAM_1 ? RESOLVED_TEAM_2 : RESOLVED_TEAM_1;
  const bt = savedTeams.find(t => t.name === bn);
  const wt = savedTeams.find(t => t.name === wn);
  const sD = document.getElementById('strikerDropdown');
  const nD = document.getElementById('nonStrikerDropdown');
  const bD = document.getElementById('bowlerDropdown');

  sD.innerHTML = '<option value="">-- From squad --</option>';
  nD.innerHTML = '<option value="">-- From squad --</option>';
  bD.innerHTML = '<option value="">-- From squad --</option>';

  if (bt && bt.squad) {
    bt.squad.forEach(p => {
      sD.innerHTML += `<option value="${p}">${p}</option>`;
      nD.innerHTML += `<option value="${p}">${p}</option>`;
    });
  }
  if (wt && wt.squad) {
    wt.squad.forEach(p => {
      bD.innerHTML += `<option value="${p}">${p}</option>`;
    });
  }
}

/* ============ IPL OPENING ANIMATION ============ */
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
      if (num > 0) {
        countdownEl.innerText = num;
        num--;
        setTimeout(tick, 900);
      } else {
        countdownEl.innerText = 'GO!';
        setTimeout(() => {
          countdownEl.classList.remove('active');
          countdownEl.innerText = '';
        }, 700);
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

function finalizeMatchStart() {
  const batName = document.getElementById('battingTeamSelect').value;
  let bowlName;
  if (batName === RESOLVED_TEAM_1) bowlName = RESOLVED_TEAM_2;
  else if (batName === RESOLVED_TEAM_2) bowlName = RESOLVED_TEAM_1;
  else { alert('Team mismatch'); return; }

  const striker = autoCapitalize((document.getElementById('strikerCustom').value || document.getElementById('strikerDropdown').value || 'Batter 1').trim());
  const nonStriker = autoCapitalize((document.getElementById('nonStrikerCustom').value || document.getElementById('nonStrikerDropdown').value || 'Batter 2').trim());
  const bowler = autoCapitalize((document.getElementById('bowlerCustom').value || document.getElementById('bowlerDropdown').value || 'Bowler 1').trim());

  if (striker.toLowerCase() === nonStriker.toLowerCase()) {
    alert("Striker and Non-Striker must be different");
    return;
  }

  autoAddPlayerToTeam(striker, batName);
  autoAddPlayerToTeam(nonStriker, batName);
  autoAddPlayerToTeam(bowler, bowlName);

  match.isActive = true;
  match.innings = 1;
  match.totalOvers = currentTourn.overs;
  match.originalOvers = currentTourn.overs;
  match.venue = currentTourn.venue;
  match.teamBatting = batName;
  match.teamBowling = bowlName;
  match.teamBattingAbbr = batName.substring(0, 3).toUpperCase();
  match.teamBowlingAbbr = bowlName.substring(0, 3).toUpperCase();
  match.runs = 0;
  match.wickets = 0;
  match.legalBalls = 0;
  match.target = 0;
  match.striker = striker;
  match.nonStriker = nonStriker;
  match.currentBowler = bowler;
  match.previousBowler = "";
  match.batters = {};
  match.bowlers = {};
  match.fielding = {};
  match.playerTeamMap = {};
  match.recentBalls = [];
  match.commentary = [];
  match.fow = [];
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
  inningsTransitionLock = false;

  matchCode = generateMatchCode();
  match.shareCode = matchCode;

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
  if (hSub) hSub.innerText = `${match.venue} • Innings 1`;

  const infoTourn = document.getElementById('infoTourn');
  const infoFix = document.getElementById('infoFixture');
  const infoVen = document.getElementById('infoVenue');
  const infoOv = document.getElementById('infoOvers');
  if (infoTourn) infoTourn.innerText = currentTourn.name;
  if (infoFix) infoFix.innerText = `${batName} vs ${bowlName}`;
  if (infoVen) infoVen.innerText = match.venue;
  if (infoOv) infoOv.innerText = match.totalOvers;

  const sndBtn = document.getElementById('btnSoundToggle');
  if (sndBtn) sndBtn.style.display = 'flex';

  closeModal('openingRolesModal');
  updateContinueButton();
  autoPersist();

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

/* ============ TEAMS RENDER & MUTATION ============ */
function renderTeamsList() {
  const c = document.getElementById('teamsListContainer');
  if (!c) return;
  if (!savedTeams || savedTeams.length === 0) {
    c.innerHTML = `<div class="panel-card" style="text-align:center;color:var(--muted);font-size:12px;padding:20px;">No teams yet.</div>`;
    return;
  }
  c.innerHTML = '';
  savedTeams.forEach((team, idx) => {
    const abbr = team.name.substring(0, 3).toUpperCase();
    const squad = team.squad || [];
    const chips = squad.length === 0
      ? `<div class="empty-squad-msg">No players yet.</div>`
      : squad.map(p => {
        const bt = bowlerTypeMap[p];
        const roleTag = bt ? `<span class="chip-role" onclick="togglePlayerType('${p.replace(/'/g, "\\'")}')">${bt === 'spin' ? '🌀Spin' : '🏏Pace'}</span>` : '';
        return `<span class="player-chip">
          <span class="chip-avatar">${p.charAt(0).toUpperCase()}</span>
          <span class="player-link" onclick="openPlayerCareerModal('${p.replace(/'/g, "\\'")}')">${p}</span>
          ${roleTag}
          <span class="chip-remove" onclick="removePlayerFromTeam(${idx},'${p.replace(/'/g, "\\'")}')">✕</span>
        </span>`;
      }).join('');

    c.innerHTML += `<div class="team-mgmt-card">
      <div class="team-header-row">
        <div class="team-name-display"><span>${team.name}</span><span class="team-abbr-badge">${abbr}</span></div>
        <span class="team-squad-count">${squad.length} player${squad.length !== 1 ? 's' : ''}</span>
      </div>
      <div class="player-chip-grid">${chips}</div>
      <div class="add-player-inline">
        <input type="text" class="form-control" placeholder="Add player" id="addPlayerInput-${idx}" onkeydown="if(event.key==='Enter')addPlayerToTeamInline(${idx})">
        <button class="btn-ui btn-primary" onclick="addPlayerToTeamInline(${idx})">➕</button>
      </div>
      <div class="team-action-row">
        <button class="btn-ui" onclick="renameTeam(${idx})">✎ Rename</button>
        <button class="btn-ui" style="background:rgba(239,68,68,.18);border-color:var(--red);color:#fca5a5;" onclick="deleteTeam(${idx})">🗑 Delete</button>
      </div>
    </div>`;
  });
}

function createNewTeamFromTab() {
  const i = document.getElementById('newTeamNameInput');
  const n = autoCapitalize(i.value.trim());
  if (!n) return alert("Enter team name");
  if (savedTeams.some(t => t.name.toLowerCase() === n.toLowerCase())) return alert("Team exists");
  savedTeams.push({ name: n, squad: [] });
  i.value = '';
  renderTeamsList();
  autoPersist();
}

function addPlayerToTeamInline(idx) {
  const i = document.getElementById('addPlayerInput-' + idx);
  const n = autoCapitalize(i.value.trim());
  if (!n) return;
  const t = savedTeams[idx];
  if (!t.squad) t.squad = [];
  if (t.squad.includes(n)) { i.value = ''; return; }
  t.squad.push(n);
  i.value = '';
  renderTeamsList();
  autoPersist();
}

function removePlayerFromTeam(ti, pn) {
  const t = savedTeams[ti];
  if (!t || !t.squad) return;
  if (!confirm(`Remove "${pn}"?`)) return;
  t.squad = t.squad.filter(p => p !== pn);
  renderTeamsList();
  autoPersist();
}

function renameTeam(idx) {
  const t = savedTeams[idx];
  const n = prompt(`Rename "${t.name}" to:`, t.name);
  if (!n || !n.trim()) return;
  const tr = autoCapitalize(n.trim());
  if (savedTeams.some((x, i) => i !== idx && x.name.toLowerCase() === tr.toLowerCase())) return alert("Name in use");
  t.name = tr;
  renderTeamsList();
  autoPersist();
}

function deleteTeam(idx) {
  const t = savedTeams[idx];
  if (!confirm(`Delete "${t.name}"?`)) return;
  savedTeams.splice(idx, 1);
  renderTeamsList();
  autoPersist();
}

function togglePlayerType(name) {
  const cur = bowlerTypeMap[name] || detectBowlerType(name);
  bowlerTypeMap[name] = cur === 'pace' ? 'spin' : 'pace';
  autoPersist();
  renderTeamsList();
}

/* ============ POINTS TABLE & PAST MATCHES ============ */
function renderPointsTable() {
  const c = document.getElementById('pointsTableBody');
  if (!c) return;
  if (!savedTeams || savedTeams.length === 0) {
    c.innerHTML = `<div style="text-align:center;color:var(--muted);font-size:11px;padding:16px;">No teams yet.</div>`;
    return;
  }
  const stats = {};
  savedTeams.forEach(t => { stats[t.name] = { name: t.name, P: 0, W: 0, L: 0, Pts: 0 }; });

  pastMatchesLedger.forEach(pm => {
    if (!pm.teamA || !pm.teamB || !pm.winner) return;
    const A = stats[pm.teamA], B = stats[pm.teamB];
    if (!A || !B) return;
    A.P++; B.P++;
    if (pm.winner === pm.teamA) { A.W++; B.L++; A.Pts += 2; }
    else if (pm.winner === pm.teamB) { B.W++; A.L++; B.Pts += 2; }
  });

  const arr = Object.values(stats).sort((a, b) => b.Pts - a.Pts);
  c.innerHTML = '';
  arr.forEach((t, i) => {
    c.innerHTML += `<div class="points-table-row">
      <div>${i + 1}</div>
      <div><b>${t.name}</b></div>
      <div>${t.P}</div>
      <div>${t.W}</div>
      <div>${t.L}</div>
      <div><b style="color:var(--green);">${t.Pts}</b></div>
      <div>0.00</div>
    </div>`;
  });
}

function renderPastMatchesList() {
  const c = document.getElementById('pastMatchesContainer');
  if (!c) return;
  if (!pastMatchesLedger || pastMatchesLedger.length === 0) {
    c.innerHTML = `<div class="panel-card" style="text-align:center;color:var(--muted);font-size:12px;padding:20px;">No past matches yet.</div>`;
    return;
  }
  c.innerHTML = '';
  pastMatchesLedger.forEach((pm, idx) => {
    c.innerHTML += `<div class="history-card">
      <div>
        <b style="font-size:13px;">${pm.fixture}</b><br>
        <span style="font-size:11px;color:var(--cyan);">${pm.result}</span>
      </div>
      <button class="btn-ui" onclick="viewPastMatchSummary(${idx})">View</button>
    </div>`;
  });
}

function viewPastMatchSummary(idx) {
  const pm = pastMatchesLedger[idx];
  if (!pm) return;
  const inn1 = pm.innings1, inn2 = pm.innings2;
  let msg = `${pm.fixture}\nResult: ${pm.result}\nVenue: ${pm.venue}\nDate: ${pm.date}\n\n`;
  if (inn1) msg += `1st Innings — ${inn1.team}: ${inn1.runs}/${inn1.wickets} (${Math.floor((inn1.balls || 0) / 6)}.${(inn1.balls || 0) % 6} ov)\n`;
  if (inn2) msg += `2nd Innings — ${inn2.team}: ${inn2.runs}/${inn2.wickets} (${Math.floor((inn2.balls || 0) / 6)}.${(inn2.balls || 0) % 6} ov)\n`;
  alert(msg);
}

/* ============ STATS LEADERBOARD ============ */
function buildStatsPool() {
  const pool = [];
  const allNames = new Set([...Object.keys(match.batters), ...Object.keys(match.bowlers), ...Object.keys(match.fielding)]);
  allNames.forEach(n => {
    const b = match.batters[n] || { runs: 0, balls: 0, fours: 0, sixes: 0, dots: 0, fifties: 0, hundreds: 0 };
    const bw = match.bowlers[n] || { balls: 0, maidens: 0, runs: 0, wickets: 0, dots: 0, threeW: 0, fiveW: 0 };
    const f = match.fielding[n] || { catches: 0, stumpings: 0, runOuts: 0 };
    const sr = b.balls > 0 ? (b.runs / b.balls) * 100 : 0;
    const eco = bw.balls > 0 ? (bw.runs / (bw.balls / 6)) : 99.9;
    const bowlSR = bw.wickets > 0 ? bw.balls / bw.wickets : 0;
    const bowlAvg = bw.wickets > 0 ? bw.runs / bw.wickets : 0;
    const mvp = Math.round((b.runs * 1) + (b.fours * 1.5) + (b.sixes * 2.5) + (bw.wickets * 25) + (f.catches * 10) + (f.stumpings * 12) - (bw.runs * 0.4));
    pool.push({
      name: n,
      team: match.playerTeamMap[n] || '--',
      runs: b.runs || 0,
      balls: b.balls || 0,
      fours: b.fours || 0,
      sixes: b.sixes || 0,
      dotsFaced: b.dots || 0,
      fifties: b.fifties || 0,
      hundreds: b.hundreds || 0,
      sr,
      status: b.status || 'dnb',
      bowlBalls: bw.balls || 0,
      bowlRuns: bw.runs || 0,
      wickets: bw.wickets || 0,
      maidens: bw.maidens || 0,
      bowlDots: bw.dots || 0,
      eco,
      bowlAvg,
      bowlSR,
      threeW: bw.threeW || 0,
      fiveW: bw.fiveW || 0,
      catches: f.catches || 0,
      stumpings: f.stumpings || 0,
      runOuts: f.runOuts || 0,
      totalDismissals: (f.catches || 0) + (f.stumpings || 0) + (f.runOuts || 0),
      mvp: Math.max(0, mvp)
    });
  });
  return pool;
}

function renderStatsCategory(cat, btnEl) {
  currentStatsCategory = cat;
  if (btnEl) {
    document.querySelectorAll('.stat-pill').forEach(p => p.classList.remove('active'));
    btnEl.classList.add('active');
  }
  const head = document.getElementById('statsTableHead');
  const body = document.getElementById('statsTableBody');
  if (!head || !body) return;
  const pool = buildStatsPool();
  if (pool.length === 0) {
    head.innerHTML = `<tr><th>Player</th><th>No stats available yet</th></tr>`;
    body.innerHTML = `<tr><td colspan="2" style="text-align:center;color:var(--muted);padding:20px;">Score some balls to see stats.</td></tr>`;
    return;
  }

  if (cat === 'mvp') {
    head.innerHTML = `<tr><th>#</th><th>Player</th><th class="text-right">MVP</th><th class="text-right">R</th><th class="text-right">W</th><th class="text-right">Ct</th></tr>`;
    pool.sort((a, b) => b.mvp - a.mvp);
    body.innerHTML = pool.map((p, i) => `<tr><td class="rank">${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1)}</td><td><span class="player-link" onclick="openPlayerCareerModal('${p.name.replace(/'/g, "\\'")}')"><span class="player-name">${p.name}</span></span><span class="team-tag">${p.team}</span></td><td class="text-right"><span class="mvp-badge">${p.mvp}</span></td><td class="text-right">${p.runs}</td><td class="text-right">${p.wickets}</td><td class="text-right">${p.catches}</td></tr>`).join('');
  } else if (cat === 'runs') {
    head.innerHTML = `<tr><th>#</th><th>Player</th><th class="text-right">Runs</th><th class="text-right">Balls</th><th class="text-right">4s</th><th class="text-right">6s</th><th class="text-right">SR</th></tr>`;
    pool.sort((a, b) => b.runs - a.runs || b.sr - a.sr);
    body.innerHTML = pool.slice(0, 15).map((p, i) => `<tr><td class="rank">${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1)}</td><td><span class="player-link" onclick="openPlayerCareerModal('${p.name.replace(/'/g, "\\'")}')"><span class="player-name">${p.name}</span></span><span class="team-tag">${p.team}</span></td><td class="text-right"><b style="color:var(--green);">${p.runs}</b></td><td class="text-right">${p.balls}</td><td class="text-right">${p.fours}</td><td class="text-right">${p.sixes}</td><td class="text-right">${p.sr.toFixed(1)}</td></tr>`).join('');
  } else if (cat === 'wickets') {
    head.innerHTML = `<tr><th>#</th><th>Player</th><th class="text-right">Wkts</th><th class="text-right">Overs</th><th class="text-right">Runs</th><th class="text-right">Eco</th></tr>`;
    pool.sort((a, b) => b.wickets - a.wickets || a.eco - b.eco);
    body.innerHTML = pool.filter(p => p.bowlBalls > 0).slice(0, 15).map((p, i) => `<tr><td class="rank">${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1)}</td><td><span class="player-link" onclick="openPlayerCareerModal('${p.name.replace(/'/g, "\\'")}')"><span class="player-name">${p.name}</span></span><span class="team-tag">${p.team}</span></td><td class="text-right"><b style="color:var(--red);">${p.wickets}</b></td><td class="text-right">${Math.floor(p.bowlBalls / 6)}.${p.bowlBalls % 6}</td><td class="text-right">${p.bowlRuns}</td><td class="text-right">${p.eco.toFixed(2)}</td></tr>`).join('');
  } else if (cat === 'fours') {
    head.innerHTML = `<tr><th>#</th><th>Player</th><th class="text-right">4s</th><th class="text-right">Runs</th><th class="text-right">Balls</th></tr>`;
    pool.sort((a, b) => b.fours - a.fours || b.runs - a.runs);
    body.innerHTML = pool.slice(0, 15).map((p, i) => `<tr><td class="rank">${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1)}</td><td><span class="player-link" onclick="openPlayerCareerModal('${p.name.replace(/'/g, "\\'")}')"><span class="player-name">${p.name}</span></span><span class="team-tag">${p.team}</span></td><td class="text-right"><b style="color:var(--cyan);">${p.fours}</b></td><td class="text-right">${p.runs}</td><td class="text-right">${p.balls}</td></tr>`).join('');
  } else if (cat === 'sixes') {
    head.innerHTML = `<tr><th>#</th><th>Player</th><th class="text-right">6s</th><th class="text-right">Runs</th><th class="text-right">Balls</th></tr>`;
    pool.sort((a, b) => b.sixes - a.sixes || b.runs - a.runs);
    body.innerHTML = pool.slice(0, 15).map((p, i) => `<tr><td class="rank">${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1)}</td><td><span class="player-link" onclick="openPlayerCareerModal('${p.name.replace(/'/g, "\\'")}')"><span class="player-name">${p.name}</span></span><span class="team-tag">${p.team}</span></td><td class="text-right"><b style="color:var(--orange);">${p.sixes}</b></td><td class="text-right">${p.runs}</td><td class="text-right">${p.balls}</td></tr>`).join('');
  } else if (cat === 'batting') {
    head.innerHTML = `<tr><th>Player</th><th class="text-right">R</th><th class="text-right">B</th><th class="text-right">4s</th><th class="text-right">6s</th><th class="text-right">SR</th><th class="text-right">50s</th><th class="text-right">100s</th></tr>`;
    pool.sort((a, b) => b.runs - a.runs);
    body.innerHTML = pool.map(p => `<tr><td><span class="player-link" onclick="openPlayerCareerModal('${p.name.replace(/'/g, "\\'")}')"><span class="player-name">${p.name}</span></span><span class="team-tag">${p.team}</span></td><td class="text-right"><b style="color:var(--green);">${p.runs}</b></td><td class="text-right">${p.balls}</td><td class="text-right">${p.fours}</td><td class="text-right">${p.sixes}</td><td class="text-right">${p.sr.toFixed(1)}</td><td class="text-right">${p.fifties}</td><td class="text-right">${p.hundreds}</td></tr>`).join('');
  } else if (cat === 'bowling') {
    head.innerHTML = `<tr><th>Player</th><th class="text-right">O</th><th class="text-right">M</th><th class="text-right">R</th><th class="text-right">W</th><th class="text-right">Eco</th><th class="text-right">Avg</th><th class="text-right">SR</th></tr>`;
    pool.sort((a, b) => b.wickets - a.wickets || a.eco - b.eco);
    body.innerHTML = pool.filter(p => p.bowlBalls > 0).map(p => `<tr><td><span class="player-link" onclick="openPlayerCareerModal('${p.name.replace(/'/g, "\\'")}')"><span class="player-name">${p.name}</span></span><span class="team-tag">${p.team}</span></td><td class="text-right">${Math.floor(p.bowlBalls / 6)}.${p.bowlBalls % 6}</td><td class="text-right">${p.maidens}</td><td class="text-right">${p.bowlRuns}</td><td class="text-right"><b style="color:var(--red);">${p.wickets}</b></td><td class="text-right">${p.eco.toFixed(2)}</td><td class="text-right">${p.bowlAvg > 0 ? p.bowlAvg.toFixed(1) : '-'}</td><td class="text-right">${p.bowlSR > 0 ? p.bowlSR.toFixed(1) : '-'}</td></tr>`).join('');
  } else if (cat === 'fielding') {
    head.innerHTML = `<tr><th>Player</th><th class="text-right">Ct</th><th class="text-right">St</th><th class="text-right">RO</th><th class="text-right">Total</th></tr>`;
    pool.sort((a, b) => b.totalDismissals - a.totalDismissals);
    body.innerHTML = pool.filter(p => p.totalDismissals > 0).map(p => `<tr><td><span class="player-link" onclick="openPlayerCareerModal('${p.name.replace(/'/g, "\\'")}')"><span class="player-name">${p.name}</span></span><span class="team-tag">${p.team}</span></td><td class="text-right">${p.catches}</td><td class="text-right">${p.stumpings}</td><td class="text-right">${p.runOuts}</td><td class="text-right"><b style="color:var(--gold);">${p.totalDismissals}</b></td></tr>`).join('');
  }
}

/* ============ PLAYER CAREER DETAILS ============ */
function openPlayerCareerModal(playerName) {
  if (!playerName) return;
  document.getElementById('careerPlayerName').innerText = playerName;
  const teamAbbr = match.playerTeamMap[playerName] || '';
  document.getElementById('careerPlayerTeam').innerText = teamAbbr ? `Playing for ${teamAbbr} • Career` : 'Career performance';
  const career = buildPlayerCareerStats(playerName);

  document.getElementById('cMatches').innerText = career.matches;
  document.getElementById('cRuns').innerText = career.runs;
  document.getElementById('cHS').innerText = career.highScore;
  document.getElementById('cAvg').innerText = career.avg;
  document.getElementById('cSR').innerText = career.sr;
  document.getElementById('cBallsFaced').innerText = career.balls;
  document.getElementById('cFifties').innerText = career.fifties;
  document.getElementById('cHundreds').innerText = career.hundreds;
  document.getElementById('cWickets').innerText = career.wickets;
  document.getElementById('cOvers').innerText = `${Math.floor(career.bowlBalls / 6)}.${career.bowlBalls % 6}`;
  document.getElementById('cBowlRuns').innerText = career.bowlRuns;
  document.getElementById('cBest').innerText = career.bestBowl;
  document.getElementById('cEco').innerText = career.eco;
  document.getElementById('cBowlAvg').innerText = career.bowlAvg;
  document.getElementById('cBowlSR').innerText = career.bowlSR;
  document.getElementById('cMaidens').innerText = career.maidens;
  document.getElementById('cCatches').innerText = career.catches;
  document.getElementById('cStumpings').innerText = career.stumpings;
  document.getElementById('cRunOuts').innerText = career.runOuts;
  document.getElementById('cTotalDismissals').innerText = career.catches + career.stumpings + career.runOuts;

  const logBox = document.getElementById('careerMatchLog');
  if (!logBox) return;
  if (career.matchLog.length === 0) {
    logBox.innerHTML = '<div style="text-align:center;color:var(--muted);font-size:12px;padding:16px;font-style:italic;">No matches played yet.</div>';
  } else {
    logBox.innerHTML = '';
    career.matchLog.forEach(m => {
      const batLine = m.batting ? `🏏 <b>${m.batting.runs}</b>(${m.batting.balls}) • ${m.batting.fours}×4 ${m.batting.sixes}×6` : '';
      const bowlLine = m.bowling ? `⚾ <b>${m.bowling.wickets}</b>/${m.bowling.runs} (${Math.floor(m.bowling.balls / 6)}.${m.bowling.balls % 6} ov)` : '';
      const fieldLine = m.fielding ? `🧤 ${m.fielding.catches}ct ${m.fielding.stumpings}st ${m.fielding.runOuts}ro` : '';
      logBox.innerHTML += `<div class="career-match-row">
        <b>${m.fixture}</b> <small style="color:var(--muted);">${m.date || ''}</small>
        <div class="cmr-line" style="color:var(--cyan);font-size:10.5px;">${m.result || ''}</div>
        <div class="cmr-line">${batLine} ${bowlLine} ${fieldLine}</div>
      </div>`;
    });
  }
  document.getElementById('playerCareerModal').style.display = 'flex';
}

function buildPlayerCareerStats(playerName) {
  const career = {
    matches: 0, runs: 0, balls: 0, fours: 0, sixes: 0, fifties: 0, hundreds: 0,
    highScore: 0, notOuts: 0, dismissals: 0, bowlBalls: 0, bowlRuns: 0,
    wickets: 0, maidens: 0, bestWkts: 0, bestRuns: Infinity, catches: 0,
    stumpings: 0, runOuts: 0, teams: new Set(), matchLog: []
  };

  function extractFromInnings(batters, bowlers, fielding) {
    let batted = false, bowled = false, fielded = false;
    let bat = null, bwl = null, fld = null;
    if (batters && batters[playerName]) {
      const b = batters[playerName];
      if (b.status && b.status !== 'dnb') {
        batted = true;
        bat = { runs: b.runs || 0, balls: b.balls || 0, fours: b.fours || 0, sixes: b.sixes || 0, status: b.status };
      }
    }
    if (bowlers && bowlers[playerName]) {
      const bw = bowlers[playerName];
      if (bw.balls > 0) {
        bowled = true;
        bwl = { balls: bw.balls, runs: bw.runs, wickets: bw.wickets, maidens: bw.maidens || 0 };
      }
    }
    if (fielding && fielding[playerName]) {
      const f = fielding[playerName];
      if ((f.catches || 0) + (f.stumpings || 0) + (f.runOuts || 0) > 0) {
        fielded = true;
        fld = { catches: f.catches || 0, stumpings: f.stumpings || 0, runOuts: f.runOuts || 0 };
      }
    }
    return { batted, bowled, fielded, bat, bwl, fld };
  }

  function mergeMatch(inningsList) {
    let played = false;
    let mBatting = null, mBowling = null, mFielding = null;
    inningsList.forEach(inn => {
      if (!inn) return;
      const res = extractFromInnings(inn.batters, inn.bowlers, inn.fielding);
      if (res.batted) {
        played = true;
        career.runs += res.bat.runs;
        career.balls += res.bat.balls;
        career.fours += res.bat.fours;
        career.sixes += res.bat.sixes;
        if (res.bat.runs > career.highScore) career.highScore = res.bat.runs;
        if (res.bat.runs >= 50 && res.bat.runs < 100) career.fifties++;
        if (res.bat.runs >= 100) career.hundreds++;
        const st = (res.bat.status || '').toLowerCase();
        if (st === 'batting' || st === 'not out' || st === 'retired not out') career.notOuts++;
        else if (st && st !== 'dnb') career.dismissals++;
        if (!mBatting) mBatting = { runs: 0, balls: 0, fours: 0, sixes: 0 };
        mBatting.runs += res.bat.runs;
        mBatting.balls += res.bat.balls;
        mBatting.fours += res.bat.fours;
        mBatting.sixes += res.bat.sixes;
      }
      if (res.bowled) {
        played = true;
        career.bowlBalls += res.bwl.balls;
        career.bowlRuns += res.bwl.runs;
        career.wickets += res.bwl.wickets;
        career.maidens += res.bwl.maidens;
        if (res.bwl.wickets > career.bestWkts || (res.bwl.wickets === career.bestWkts && res.bwl.runs < career.bestRuns)) {
          career.bestWkts = res.bwl.wickets;
          career.bestRuns = res.bwl.runs;
        }
        if (!mBowling) mBowling = { balls: 0, runs: 0, wickets: 0 };
        mBowling.balls += res.bwl.balls;
        mBowling.runs += res.bwl.runs;
        mBowling.wickets += res.bwl.wickets;
      }
      if (res.fielded) {
        played = true;
        career.catches += res.fld.catches;
        career.stumpings += res.fld.stumpings;
        career.runOuts += res.fld.runOuts;
        if (!mFielding) mFielding = { catches: 0, stumpings: 0, runOuts: 0 };
        mFielding.catches += res.fld.catches;
        mFielding.stumpings += res.fld.stumpings;
        mFielding.runOuts += res.fld.runOuts;
      }
    });
    return { played, mBatting, mBowling, mFielding };
  }

  pastMatchesLedger.forEach(pm => {
    const inningsList = [];
    if (pm.innings1) inningsList.push(pm.innings1);
    if (pm.innings2) inningsList.push(pm.innings2);
    const merged = mergeMatch(inningsList);
    if (merged.played) {
      career.matches++;
      if (pm.teamA) career.teams.add(pm.teamA);
      if (pm.teamB) career.teams.add(pm.teamB);
      career.matchLog.push({
        fixture: pm.fixture,
        result: pm.result,
        date: pm.date,
        batting: merged.mBatting,
        bowling: merged.mBowling,
        fielding: merged.mFielding
      });
    }
  });

  if (match.isActive) {
    const inningsList = [];
    if (match.innings === 2) {
      inningsList.push({
        batters: match.innings1BattingSnapshot || {},
        bowlers: match.innings1BowlingSnapshot || {},
        fielding: match.innings1FieldingSnapshot || {}
      });
    }
    inningsList.push({ batters: match.batters, bowlers: match.bowlers, fielding: match.fielding });
    const merged = mergeMatch(inningsList);
    if (merged.played) {
      career.matches++;
      career.teams.add(match.teamBatting);
      career.teams.add(match.teamBowling);
      career.matchLog.unshift({
        fixture: `${match.teamBatting} vs ${match.teamBowling} (Live)`,
        result: match.innings === 2 ? `Target: ${match.target}` : 'Innings 1 in progress',
        date: 'Today',
        batting: merged.mBatting,
        bowling: merged.mBowling,
        fielding: merged.mFielding
      });
    }
  }

  career.teams = Array.from(career.teams).filter(Boolean);
  career.bestBowl = career.bestWkts > 0 ? `${career.bestWkts}/${career.bestRuns}` : '—';
  career.avg = career.dismissals > 0 ? (career.runs / career.dismissals).toFixed(1) : (career.runs > 0 ? `${career.runs}*` : '0.0');
  career.sr = career.balls > 0 ? ((career.runs / career.balls) * 100).toFixed(1) : '0.0';
  career.eco = career.bowlBalls > 0 ? (career.bowlRuns / (career.bowlBalls / 6)).toFixed(2) : '0.0';
  career.bowlAvg = career.wickets > 0 ? (career.bowlRuns / career.wickets).toFixed(1) : '—';
  career.bowlSR = career.wickets > 0 ? (career.bowlBalls / career.wickets).toFixed(1) : '—';
  return career;
}

/* ============ WICKET MODAL & UNIFIED DISMISSAL FLOW ============ */
function handleWicketMethodChange(m) {
  const fg = document.getElementById('fielderGroup');
  const fl = document.getElementById('fielderLabel');
  const rg = document.getElementById('runOutRunsGroup');

  if (rg) rg.style.display = (m === 'Run Out') ? 'block' : 'none';

  if (!fg || !fl) return;
  if (m === 'Caught') {
    fg.style.display = 'block';
    fl.innerText = 'Catching Fielder';
  } else if (m === 'Run Out') {
    fg.style.display = 'block';
    fl.innerText = 'Run-Out Fielder';
  } else if (m === 'Stumped') {
    fg.style.display = 'block';
    fl.innerText = 'Wicketkeeper';
  } else {
    fg.style.display = 'none';
  }
}

function promptWicketTypeModal() {
  if (!match.isActive || isViewerMode) return;
  if (match.wickets >= 10) {
    showToast('All out — 10 wickets already');
    return;
  }
  handleWicketMethodChange("Bowled");
  document.getElementById('wktMethodSelect').value = "Bowled";
  document.getElementById('fielderCustomInput').value = '';
  document.getElementById('wktNewBatsmanInput').value = '';

  const rSel = document.getElementById('runOutRunsSelect');
  if (rSel) rSel.value = '0';
  const rGrp = document.getElementById('runOutRunsGroup');
  if (rGrp) rGrp.style.display = 'none';

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
    if (b && b.status && b.status !== 'dnb' && b.status !== 'batting') return;
    if (!available.includes(pl)) available.push(pl);
  });

  for (const k in match.batters) {
    if (match.batters[k].status === 'dnb' && k !== match.nonStriker && k !== match.striker && !available.includes(k)) {
      available.push(k);
    }
  }

  available.forEach(p => {
    dd.innerHTML += `<option value="${p}">${p}</option>`;
  });

  dd.onchange = () => {
    if (dd.value) document.getElementById('wktNewBatsmanInput').value = '';
  };
  const txtInput = document.getElementById('wktNewBatsmanInput');
  if (txtInput) {
    txtInput.oninput = () => { dd.value = ''; };
  }
}

/* ============================================================
   SINGLE DEFINITIVE WICKET HANDLER (Fixes Issues 1, 2, & 3)
   ============================================================ */
function confirmWicketDelivery() {
  const methodEl = document.getElementById('wktMethodSelect');
  const method = methodEl ? methodEl.value : 'Bowled';
  let fielder = (document.getElementById('fielderCustomInput').value || '').trim();
  if (['Caught', 'Run Out', 'Stumped'].includes(method) && !fielder) {
    fielder = method === 'Stumped' ? 'Wicketkeeper' : 'Fielder';
  }

  const typed = (document.getElementById('wktNewBatsmanInput').value || '').trim();
  const selected = (document.getElementById('wktNewBatsmanSelect').value || '').trim();
  let newBatter = autoCapitalize(typed || selected || '');

  let runOutRuns = 0;
  if (method === 'Run Out') {
    const rSel = document.getElementById('runOutRunsSelect');
    if (rSel) runOutRuns = parseInt(rSel.value, 10) || 0;
  }

  closeModal('wicketTypeModal');

  const dismissedBatter = match.striker;

  // Single-pass recordBall invocation carrying runs completed before run-out
  recordBall(runOutRuns, null, true, "", 0, { method, fielder });

  // If new batter was provided, assign and activate immediately
  if (newBatter) {
    if (!match.batters[newBatter]) {
      autoAddPlayerToTeam(newBatter, match.teamBatting);
      match.batters[newBatter] = { runs: 0, balls: 0, fours: 0, sixes: 0, dots: 0, fifties: 0, hundreds: 0, status: 'batting' };
      match.playerTeamMap[newBatter] = match.teamBattingAbbr;
    } else {
      match.batters[newBatter].status = 'batting';
    }

    match.striker = newBatter;

    // Clean up non-striker slot if the dismissed player remained
    if (match.nonStriker === dismissedBatter) {
      let partner = '';
      for (const k in match.batters) {
        if (k !== newBatter && k !== dismissedBatter && match.batters[k].status === 'dnb') {
          partner = k;
          break;
        }
      }
      if (partner) {
        match.batters[partner].status = 'batting';
        match.nonStriker = partner;
      } else {
        match.nonStriker = '';
      }
    }

    match.currentPartnership = { runs: 0, balls: 0, batters: [newBatter, match.nonStriker] };
    window.match = match;

    renderLive();
    renderScorecard();
    renderCommentary();
    renderSummary();
    autoPersist();
    broadcastMatchState();

    if (isCommentaryVoiceActive) {
      speak(`New batter in: ${newBatter}.`);
    }
  } else {
    // If no replacement was chosen, prompt the next batter modal
    promptNextBatterModal(dismissedBatter);
  }
}

/* ============ NEXT BATTER & BOWLER PROMPTS ============ */
function promptNextBatterModal(out) {
  const notice = document.getElementById('dismissedNotice');
  if (notice) notice.innerText = (out || 'Batter') + ' out! Next batter?';
  const s = document.getElementById('existingBatterSelect');
  if (!s) return;
  s.innerHTML = '<option value="">-- Squad --</option>';
  for (const n in match.batters) {
    if (match.batters[n].status === 'dnb' && n !== match.nonStriker && n !== match.striker) {
      s.innerHTML += `<option value="${n}">${n}</option>`;
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
  const typed = t ? t.value.trim() : '';
  const selected = s ? s.value : '';
  const n = autoCapitalize(typed || selected);
  if (!n) return alert('Please specify next batter');

  if (typed) autoAddPlayerToTeam(typed, match.teamBatting);

  if (!match.batters[n]) {
    match.batters[n] = { runs: 0, balls: 0, fours: 0, sixes: 0, dots: 0, fifties: 0, hundreds: 0, status: "batting" };
    match.playerTeamMap[n] = match.teamBattingAbbr;
  } else {
    match.batters[n].status = 'batting';
  }

  if (match.batters[match.nonStriker] && match.batters[match.nonStriker].status !== 'batting') {
    match.nonStriker = n;
  } else {
    match.striker = n;
  }

  closeModal('nextBatterModal');
  match.currentPartnership = { runs: 0, balls: 0, batters: [match.striker, match.nonStriker] };
  renderLive();
  renderScorecard();
  renderCommentary();
  autoPersist();
  broadcastMatchState();
  if (isCommentaryVoiceActive) speak('New batter in: ' + n + '.');
}

function promptNextBowlerModal() {
  if (!match.isActive || isViewerMode) return;
  const s = document.getElementById('existingBowlerSelect');
  if (!s) return;
  s.innerHTML = '<option value="">-- Squad --</option>';
  for (const n in match.bowlers) {
    if (n !== match.previousBowler) s.innerHTML += `<option value="${n}">${n}</option>`;
  }
  const inp = document.getElementById('newBowlerNameInput');
  if (inp) inp.value = '';
  const m = document.getElementById('bowlerModal');
  if (m) m.style.display = 'flex';
}

function confirmNextBowler() {
  const t = document.getElementById('newBowlerNameInput');
  const s = document.getElementById('existingBowlerSelect');
  const typed = t ? t.value.trim() : '';
  const selected = s ? s.value : '';
  const n = autoCapitalize(typed || selected);
  if (!n) return alert('Please specify next bowler');

  if (typed) autoAddPlayerToTeam(typed, match.teamBowling);
  if (!match.bowlers[n]) {
    match.bowlers[n] = { balls: 0, maidens: 0, runs: 0, wickets: 0, dots: 0, threeW: 0, fiveW: 0 };
    match.playerTeamMap[n] = match.teamBowlingAbbr;
  }
  match.currentBowler = n;
  closeModal('bowlerModal');
  renderLive();
  autoPersist();
  broadcastMatchState();
  if (isCommentaryVoiceActive) speak('Bowling change. ' + n + ' comes into the attack.');
}

/* ============ WAGON WHEEL & FIELD DRAWING ============ */
function triggerFlashOverlay(titleText, subText) {
  const overlay = document.getElementById('wagonFlashOverlay');
  if (!overlay) return;
  const t = document.getElementById('flashOverlayTitle');
  const s = document.getElementById('flashOverlaySub');
  if (t) t.innerText = titleText;
  if (s) s.innerText = subText;
  overlay.className = 'wagon-flash-overlay active';
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => { overlay.className = 'wagon-flash-overlay'; }, 2000);
}

function promptWagonWheel(runs) {
  if (!match.isActive || isViewerMode) return;
  pendingRuns = runs;
  document.getElementById('wagonTitle').innerText = `MARK SHOT (${runs} RUNS)`;
  document.getElementById('wagonFeedback').innerText = "Tap field to place shot";
  const banner = document.getElementById('wagonBoundaryBanner');
  if (banner) {
    banner.className = 'wagon-boundary-banner';
    banner.style.display = 'none';
  }
  const overlay = document.getElementById('wagonFlashOverlay');
  if (overlay) overlay.className = 'wagon-flash-overlay';
  document.getElementById('wagonModal').style.display = 'flex';
  drawFieldBase();
}

function drawFieldBase() {
  const cv = document.getElementById('wagonCanvas');
  if (!cv) return; // Guard against missing canvas
  const ctx = cv.getContext('2d');
  const cx = cv.width / 2, cy = cv.height / 2;
  const rope = (cv.width / 2) * 0.8;
  ctx.clearRect(0, 0, cv.width, cv.height);
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(cx, cy, rope * 0.45, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, rope * 0.75, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = 'rgba(0,230,118,0.8)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(cx, cy, rope, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#d2b48c';
  ctx.fillRect(cx - 4, cy - 12, 8, 24);
}

function drawScoringWagonShot(cx, cy, lx, ly, ballX, ballY) {
  drawFieldBase();
  const cv = document.getElementById('wagonCanvas');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  ctx.save();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
  ctx.shadowColor = '#ffffff';
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(lx, ly);
  ctx.stroke();
  ctx.restore();

  if (typeof ballX === 'number' && typeof ballY === 'number') {
    ctx.save();
    ctx.fillStyle = '#ff0000';
    ctx.shadowColor = '#ff0000';
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.arc(ballX, ballY, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }
}

const cvWheel = document.getElementById('wagonCanvas');
if (cvWheel) {
  cvWheel.addEventListener('pointerdown', (e) => {
    if (!match.isActive || isViewerMode) return;
    const rect = cvWheel.getBoundingClientRect();
    const scaleX = cvWheel.width / rect.width, scaleY = cvWheel.height / rect.height;
    const cx = cvWheel.width / 2, cy = cvWheel.height / 2;
    const clickX = (e.clientX - rect.left) * scaleX, clickY = (e.clientY - rect.top) * scaleY;
    const dx = clickX - cx, dy = clickY - cy;
    const rawDist = Math.sqrt(dx * dx + dy * dy);
    if (rawDist < 5) return;
    const dirX = dx / rawDist, dirY = dy / rawDist;

    let deg = Math.atan2(dy, dx) * (180 / Math.PI);
    if (deg < 0) deg += 360;
    const sectorIdx = Math.floor(((deg + 22.5) % 360) / 45);
    const sectorNames = ["Point", "Third Man", "Fine Leg", "Square Leg", "Mid-Wicket", "Long-on", "Long-off", "Cover"];
    const region = sectorNames[sectorIdx];
    const ropeR = (cvWheel.width / 2) * 0.8;

    let lx = clickX, ly = clickY, dm = 0;
    if (pendingRuns >= 1 && pendingRuns <= 3) {
      const maxR = ropeR - 6;
      let tr = rawDist;
      if (pendingRuns === 1) tr = Math.min(maxR * 0.65, Math.max(ropeR * 0.35, rawDist));
      else if (pendingRuns === 2) tr = Math.min(maxR * 0.85, Math.max(ropeR * 0.5, rawDist));
      else tr = Math.min(maxR, Math.max(ropeR * 0.7, rawDist));
      lx = cx + dirX * tr; ly = cy + dirY * tr;
    } else if (pendingRuns === 4) {
      lx = cx + dirX * ropeR; ly = cy + dirY * ropeR;
    } else if (pendingRuns === 6) {
      const minR = ropeR * 1.08, maxR = ropeR * 1.22;
      const fr = Math.max(minR, Math.min(maxR, rawDist));
      lx = cx + dirX * fr; ly = cy + dirY * fr;
      dm = Math.round(75 + ((fr - ropeR) / (ropeR * 0.22)) * 45);
    }

    const flightStart = performance.now();
    const flightDuration = 500;
    const animateFlyingBall = () => {
      const elapsed = performance.now() - flightStart;
      const progress = Math.min(1, elapsed / flightDuration);
      const eased = 1 - Math.pow(1 - progress, 2);
      const bx = cx + (lx - cx) * eased;
      const by = cy + (ly - cy) * eased;
      drawScoringWagonShot(cx, cy, lx, ly, bx, by);
      if (progress < 1) requestAnimationFrame(animateFlyingBall);
      else drawScoringWagonShot(cx, cy, lx, ly, lx, ly);
    };
    animateFlyingBall();

    document.getElementById('wagonFeedback').innerText = `${region}${dm > 0 ? ' • ' + dm + 'm' : ''}`;
    match.sectorRuns[sectorIdx] += pendingRuns;

    if (pendingRuns === 4) {
      triggerFlashOverlay("CRACKING FOUR", "Boundary Scored ⚡");
      triggerBanner('CRACKING FOUR! ⚡', `Through ${region}`, 'fx-four');
    } else if (pendingRuns === 6) {
      triggerFlashOverlay("MASSIVE SIX", `Maximum ${dm}m 🔥`);
      triggerBanner('MASSIVE SIX! 🔥', `${dm}m over ${region}`, 'fx-six');
    }

    const banner = document.getElementById('wagonBoundaryBanner');
    const bannerMain = document.getElementById('wagonBannerMainText');
    const bannerSub = document.getElementById('wagonBannerSubText');
    if (pendingRuns === 4 && banner) {
      banner.className = 'wagon-boundary-banner is-four active';
      bannerMain.innerText = 'CRACKING FOUR! ⚡';
      bannerSub.innerText = `Races to the boundary rope towards ${region}!`;
    } else if (pendingRuns === 6 && banner) {
      banner.className = 'wagon-boundary-banner is-six active';
      bannerMain.innerText = 'MASSIVE SIX! 🔥';
      bannerSub.innerText = `Dispatched into the stands [${dm}m] over ${region}!`;
    }

    clearTimeout(window._wagonTimer);
    const _runsToRecord = pendingRuns;
    const delay = (pendingRuns === 4 || pendingRuns === 6) ? 2100 : 900;
    window._wagonTimer = setTimeout(() => {
      const _wm = document.getElementById('wagonModal');
      if (_wm) _wm.style.display = 'none';
      recordBall(_runsToRecord, null, false, region, dm);
    }, delay);
  });
}

function triggerBanner(t, s, c) {
  const b = document.getElementById('topCinematicBanner');
  if (!b) return;
  const bt = document.getElementById('topBannerTitle');
  const bs = document.getElementById('topBannerSub');
  if (bt) bt.innerText = t;
  if (bs) bs.innerText = s;
  b.className = 'top-cinematic-banner';
  void b.offsetWidth;
  b.classList.add(c, 'active');
  clearTimeout(window._bannerTimer);
  window._bannerTimer = setTimeout(() => { b.className = 'top-cinematic-banner'; }, 2400);
}

/* ============ PHRASE PICKER & COMMENTARY ============ */
function pickFresh(key, arr) {
  if (!usedPhrases[key]) usedPhrases[key] = [];
  const used = usedPhrases[key];
  let av = arr.filter(p => !used.includes(p));
  if (av.length === 0) {
    used.length = 0;
    av = arr;
  }
  const c = av[Math.floor(Math.random() * av.length)];
  used.push(c);
  if (used.length > Math.min(6, arr.length - 1)) used.shift();
  return c;
}

function fill(t, v) {
  return t.replace(/{STRIKER}/g, v.striker || '')
    .replace(/{BOWLER}/g, v.bowler || '')
    .replace(/{REGION}/g, v.region || 'the field')
    .replace(/{DIST}/g, v.dist || '');
}

const P = {
  DOT: ["{STRIKER} defends into {REGION}, no run.", "Good length from {BOWLER}, defended.", "Beaten! Past the outside edge.", "Dot ball, pushed to {REGION}.", "Fielded at {REGION}.", "Straight to hand.", "Solid forward defence.", "Tight line from {BOWLER}."],
  ONE: ["Nudged into {REGION}, quick single.", "Worked off pads, one run.", "Pushed down to {REGION}, single.", "Driven into {REGION} for one."],
  TWO: ["Placed into {REGION}, brace.", "Flicked away, two runs.", "Couple taken."],
  THREE: ["Drilled wide of {REGION}, three runs!", "Timed beautifully, three runs."],
  FOUR: ["FOUR! Cracking shot through {REGION}!", "FOUR! Races past the rope at {REGION}!", "FOUR! Pure timing through {REGION}!", "FOUR! Finds the fence at {REGION}!", "FOUR! Caressed through {REGION}!", "FOUR! Tracer bullet to {REGION}!"],
  SIX: ["SIX! {STRIKER} goes big over {REGION} {DIST}!", "SIX! Into the stands over {REGION}!", "SIX! Massive hit! {DIST}", "SIX! Out of the ground! {DIST}", "SIX! Enormous over {REGION}!"],
  WB: ["BOWLED! {BOWLER} through the gate! {STRIKER} gone!", "CLEANED HIM UP! {BOWLER} finds the timber!", "BOWLED! What a delivery!"],
  WC: ["CAUGHT! {STRIKER} has holed out!", "TAKEN! Great catch!", "CAUGHT! Straight down the throat!"],
  WL: ["LBW! {BOWLER} traps {STRIKER} plumb!", "LBW! Out!"],
  WR: ["RUN OUT! Direct hit!", "RUN OUT! Brilliant work!"],
  WS: ["STUMPED! Lightning glovework!"],
  WD: ["Wide! {BOWLER} strays down the side.", "That's a wide!"],
  NB: ["No ball! {BOWLER} overstepped!", "Front foot no ball!"],
  LB: ["Leg bye! Off the pad, they steal a run."]
};

function genComm(runs, extra, isWkt, region, distance, dd) {
  const s = match.striker || 'Batter', b = match.currentBowler || 'Bowler', dir = region || 'the field';
  const d = distance > 0 ? `[${distance}m]` : '';
  const v = { striker: s, bowler: b, region: dir, dist: d };

  if (extra === 'WD') return fill(pickFresh('WD', P.WD), v);
  if (extra === 'NB') return fill(pickFresh('NB', P.NB), v);
  if (extra === 'B') return "Bye taken.";
  if (extra === 'LB') return fill(pickFresh('LB', P.LB), v);
  if (isWkt) {
    if (!dd || !dd.method) return `OUT! ${s} dismissed!`;
    if (dd.method === 'Bowled') return fill(pickFresh('WB', P.WB), v);
    if (dd.method === 'Caught') return fill(pickFresh('WC', P.WC), v);
    if (dd.method === 'LBW') return fill(pickFresh('WL', P.WL), v);
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

/* ============================================================
   ROBUST RECORD-BALL SCORING ENGINE (Fixes Issues 4 & 5)
   ============================================================ */
function recordBall(runs = 0, extra = null, isWicket = false, region = "", distance = 0, dd = null) {
  if (!match.isActive || isViewerMode) return;

  // Ensure participants exist in state to eliminate undefined crashes
  if (!match.striker) match.striker = 'Striker';
  if (!match.nonStriker) match.nonStriker = 'Non-Striker';
  if (!match.currentBowler) match.currentBowler = 'Bowler';

  if (!match.batters[match.striker]) {
    match.batters[match.striker] = { runs: 0, balls: 0, fours: 0, sixes: 0, dots: 0, fifties: 0, hundreds: 0, status: 'batting' };
    match.playerTeamMap[match.striker] = match.teamBattingAbbr;
  }
  if (!match.batters[match.nonStriker]) {
    match.batters[match.nonStriker] = { runs: 0, balls: 0, fours: 0, sixes: 0, dots: 0, fifties: 0, hundreds: 0, status: 'batting' };
    match.playerTeamMap[match.nonStriker] = match.teamBattingAbbr;
  }
  if (!match.bowlers[match.currentBowler]) {
    match.bowlers[match.currentBowler] = { balls: 0, maidens: 0, runs: 0, wickets: 0, dots: 0, threeW: 0, fiveW: 0 };
    match.playerTeamMap[match.currentBowler] = match.teamBowlingAbbr;
  }

  historyStack.push(JSON.parse(JSON.stringify(match)));

  const striker = match.batters[match.striker];
  const bowler = match.bowlers[match.currentBowler];
  let tag = runs.toString();
  const dismPlayer = match.striker;
  const desc = genComm(runs, extra, isWicket, region, distance, dd);
  const prevRuns = striker.runs;
  const prevTeam = match.runs;
  const wasFH = match.isFreeHit;

  if (extra !== 'WD' && extra !== 'NB') {
    if (!match.currentPartnership) match.currentPartnership = { runs: 0, balls: 0, batters: [match.striker, match.nonStriker] };
    match.currentPartnership.balls = (match.currentPartnership.balls || 0) + 1;
  }

  const zoneIndex = region ? ["Point", "Third Man", "Fine Leg", "Square Leg", "Mid-Wicket", "Long-on", "Long-off", "Cover"].indexOf(region) : -1;
  const overNum = Math.floor(match.legalBalls / 6) + 1;
  const bowlerType = detectBowlerType(match.currentBowler);

  const shotPayload = {
    inns: match.innings,
    over: overNum,
    ball: match.legalBalls + 1,
    batter: match.striker,
    bowler: match.currentBowler,
    runs: runs || 0,
    zone: region || '',
    zoneIndex: zoneIndex,
    isWicket: !!isWicket,
    isFour: runs === 4,
    isSix: runs === 6,
    isBoundary: runs === 4 || runs === 6,
    isDot: runs === 0 && !extra,
    extra: extra || null,
    bowlerType: bowlerType,
    distance: distance || 0,
    ballRandom: Math.random()
  };
  match.shotLog.push(shotPayload);

  if (extra === 'WD') {
    const wideBase = (typeof matchConfig.wideRuns === 'number') ? matchConfig.wideRuns : 1;
    match.runs += wideBase + runs;
    bowler.runs += wideBase + runs;
    const totalWide = (wideBase + runs);
    tag = totalWide > 1 ? `${totalWide}Wd` : `${wideBase}Wd`;
    if (matchConfig.wideCountsAsBall) {
      match.legalBalls += 1;
      bowler.balls += 1;
      if (!isWicket) striker.balls += 1;
    }
  } else if (extra === 'NB') {
    const nbBase = (typeof matchConfig.nbRuns === 'number') ? matchConfig.nbRuns : 1;
    match.runs += nbBase + runs;
    bowler.runs += nbBase + runs;
    striker.balls = (striker.balls || 0) + 1;
    if (runs > 0) {
      striker.runs = (striker.runs || 0) + runs;
      if (runs === 4) striker.fours = (striker.fours || 0) + 1;
      if (runs === 6) striker.sixes = (striker.sixes || 0) + 1;
    }
    if (match.currentPartnership) {
      match.currentPartnership.balls = (match.currentPartnership.balls || 0) + 1;
    }
    const totalNB = nbBase + runs;
    tag = totalNB > 1 ? `${totalNB}Nb` : `${nbBase}Nb`;
    if (matchConfig.autoFreeHitOnNB) match.isFreeHit = true;
  } else if (extra === 'B') {
    match.runs += runs;
    match.legalBalls += 1;
    bowler.balls += 1;
    striker.balls += 1;
    tag = `${runs}B`;
    if (runs % 2 !== 0) swapStrikers();
  } else if (extra === 'LB') {
    match.runs += runs;
    match.legalBalls += 1;
    bowler.balls += 1;
    striker.balls += 1;
    tag = `${runs}Lb`;
    if (runs % 2 !== 0) swapStrikers();
  } else if (isWicket) {
    match.wickets += 1;
    match.legalBalls += 1;
    bowler.balls += 1;
    striker.balls += 1;

    // Credit runs completed before run-out
    if (runs > 0) {
      striker.runs += runs;
      match.runs += runs;
      if (runs === 4) striker.fours += 1;
      if (runs === 6) striker.sixes += 1;
    }

    const method = dd ? dd.method : 'Bowled';
    if (method !== 'Run Out') {
      bowler.wickets += 1;
      if (bowler.wickets === 3) bowler.threeW = (bowler.threeW || 0) + 1;
      if (bowler.wickets === 5) bowler.fiveW = (bowler.fiveW || 0) + 1;
    }

    striker.status = method === 'Bowled' ? `b ${match.currentBowler}` : `${method.toLowerCase()} b ${match.currentBowler}`;
    tag = 'W';

    if (dd && ['Caught', 'Run Out', 'Stumped'].includes(dd.method)) {
      const fn = dd.fielder || 'Fielder';
      if (!match.fielding[fn]) match.fielding[fn] = { catches: 0, stumpings: 0, runOuts: 0 };
      if (dd.method === 'Caught') match.fielding[fn].catches += 1;
      else if (dd.method === 'Stumped' && matchConfig.autoDetectStumpings) match.fielding[fn].stumpings += 1;
      else if (dd.method === 'Run Out') match.fielding[fn].runOuts += 1;
    }

    match.fow.push(`${match.runs}/${match.wickets} (${dismPlayer})`);
    match.partnerRuns.push({ ...match.currentPartnership });
    triggerBanner('WICKET! 🚨', `${dismPlayer} out`, 'fx-wicket');
  } else {
    match.runs += runs;
    match.legalBalls += 1;
    bowler.balls += 1;
    bowler.runs += runs;
    striker.balls += 1;
    striker.runs += runs;
    if (runs === 0) {
      striker.dots = (striker.dots || 0) + 1;
      bowler.dots = (bowler.dots || 0) + 1;
    }
    if (runs === 4) striker.fours += 1;
    if (runs === 6) striker.sixes += 1;
    if (runs % 2 !== 0) swapStrikers();
    if (prevRuns < 50 && striker.runs >= 50) {
      striker.fifties = (striker.fifties || 0) + 1;
      triggerBanner('HALF CENTURY! 🌟', `${match.striker} 50!`, 'fx-milestone');
    } else if (prevRuns < 100 && striker.runs >= 100) {
      striker.hundreds = (striker.hundreds || 0) + 1;
      triggerBanner('CENTURY! 👑', `${match.striker} 100!`, 'fx-milestone');
    }
  }

  if (wasFH) match.isFreeHit = false;
  if (matchConfig.forceFreeHit) match.isFreeHit = true;

  match.recentBalls.push(tag);
  match.currentOverBalls.push(tag);
  match.cumulativeWorm.push(match.runs);

  const ov = `${Math.floor(match.legalBalls / 6)}.${match.legalBalls % 6}`;
  match.commentary.unshift({
    ball: ov,
    desc: desc,
    type: isWicket ? 'w' : (runs === 4 ? 'four' : (runs === 6 ? 'six' : 'normal'))
  });
  match.currentPartnership.runs += runs;

  if (!isWicket) {
    if (prevTeam < 50 && match.runs >= 50) setTimeout(() => triggerBanner('TEAM 50 UP! 💯', `${match.teamBatting} reach 50`, 'fx-milestone'), 1900);
    else if (prevTeam < 100 && match.runs >= 100) setTimeout(() => triggerBanner('TEAM 100 UP! 💯', `${match.teamBatting} reach 100`, 'fx-milestone'), 1900);
  }

  autoPersist();

  // Over completion evaluation
  let overEnded = false;
  let overRunsThisOver = 0;
  const isRegularLegalOver = (extra !== 'WD' && extra !== 'NB' && match.legalBalls % 6 === 0 && match.legalBalls > 0);
  const isWideCountLegalOver = (matchConfig.wideCountsAsBall && extra === 'WD' && match.legalBalls % 6 === 0 && match.legalBalls > 0);

  if (isRegularLegalOver || isWideCountLegalOver) {
    swapStrikers();
    match.oversTimeline.push({ overNum: match.legalBalls / 6, balls: [...match.currentOverBalls] });
    const lastOver = match.oversTimeline[match.oversTimeline.length - 1];

    // Resilient run tallying from ball badge strings
    overRunsThisOver = lastOver.balls.reduce((sum, b) => {
      const matchNum = String(b).match(/\d+/);
      return sum + (matchNum ? parseInt(matchNum[0], 10) : 0);
    }, 0);

    const hasExtra = lastOver.balls.some(b => b.includes('Wd') || b.includes('Nb'));
    match.currentOverBalls = [];
    match.previousBowler = match.currentBowler;
    overEnded = true;
    if (overRunsThisOver === 0 && !hasExtra && bowler.maidens !== undefined) {
      bowler.maidens += 1;
    }
  }

  if (overEnded) {
    const overNumber = match.legalBalls / 6;
    const stStats = match.batters[match.striker] || { runs: 0, balls: 0 };
    const nsStats = match.batters[match.nonStriker] || { runs: 0, balls: 0 };
    const bwlStats = match.bowlers[match.currentBowler] || { balls: 0, maidens: 0, runs: 0, wickets: 0 };
    const ovStr = `${Math.floor(bwlStats.balls / 6)}.${bwlStats.balls % 6}`;
    const summaryDesc = `<span class="sum-line"><b>End of Over ${overNumber}</b> — <span class="sum-team">${match.teamBattingAbbr} ${match.runs}/${match.wickets}</span> • ${overRunsThisOver} run${overRunsThisOver !== 1 ? 's' : ''} this over</span><span class="sum-line">🏏 ${match.striker} <b>${stStats.runs}</b>(${stStats.balls}) • ${match.nonStriker} <b>${nsStats.runs}</b>(${nsStats.balls})</span><span class="sum-line">⚾ <span class="sum-bowler">${match.currentBowler}</span> ${ovStr}-${bwlStats.maidens}-${bwlStats.runs}-<b>${bwlStats.wickets}</b></span>`;
    match.commentary.unshift({ ball: `End Ov ${overNumber}`, desc: summaryDesc, type: 'summary', html: true });
  }

  renderLive();
  renderCommentary();
  renderSummary();
  broadcastMatchState(shotPayload);

  if (isCommentaryVoiceActive) speak(desc);

  if (overEnded) {
    setTimeout(() => {
      const wk = document.getElementById('wicketTypeModal');
      if (wk && wk.style.display === 'flex') {
        setTimeout(() => {
          const wk2 = document.getElementById('wicketTypeModal');
          if (!wk2 || wk2.style.display !== 'flex') promptNextBowlerModal();
        }, 1200);
      } else {
        promptNextBowlerModal();
      }
    }, 900);
  }

  checkMatchEnd();
}

function checkMatchEnd() {
  if (!match.isActive || inningsTransitionLock) return;
  if (match.innings === 2 && match.target > 0 && match.runs >= match.target) {
    inningsTransitionLock = true;
    setTimeout(() => {
      inningsTransitionLock = false;
      endMatchAndDeclareWinner(true);
    }, 1500);
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
  match.innings1Score = { team: match.teamBatting, runs: match.runs, wickets: match.wickets, balls: match.legalBalls };
  match.innings1PartnerRuns = [...match.partnerRuns];
  match.innings1Fow = [...match.fow];
  match.innings1SectorRuns = [...match.sectorRuns];
  match.innings1BattingSnapshot = JSON.parse(JSON.stringify(match.batters));
  match.innings1BowlingSnapshot = JSON.parse(JSON.stringify(match.bowlers));
  match.innings1FieldingSnapshot = JSON.parse(JSON.stringify(match.fielding));
}

function transitionToInnings2() {
  match.innings = 2;
  match.target = match.runs + 1;
  match.runs = 0;
  match.wickets = 0;
  match.legalBalls = 0;
  match.recentBalls = [];
  match.currentOverBalls = [];
  match.cumulativeWorm = [0];
  match.previousBowler = '';
  match.isFreeHit = false;
  match.partnerRuns = [];
  match.currentPartnership = { runs: 0, balls: 0, batters: [] };
  match.lastBowlerWkts = [];
  usedPhrases = {};
  match.sectorRuns = [0, 0, 0, 0, 0, 0, 0, 0];
  match.batters = {};
  match.bowlers = {};
  match.fielding = {};
  match.playerTeamMap = {};

  const tn = match.teamBatting; match.teamBatting = match.teamBowling; match.teamBowling = tn;
  const ta = match.teamBattingAbbr; match.teamBattingAbbr = match.teamBowlingAbbr; match.teamBowlingAbbr = ta;

  const hTitle = document.getElementById('headerMainTitle');
  const hSub = document.getElementById('headerSubTitle');
  const tBlock = document.getElementById('targetBlock');
  const tVal = document.getElementById('targetVal');
  if (hTitle) hTitle.innerText = `${match.teamBatting} vs ${match.teamBowling}`;
  if (hSub) hSub.innerText = `Target: ${match.target}`;
  if (tBlock) tBlock.style.display = 'block';
  if (tVal) tVal.innerText = match.target;

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
        <td><span class="player-link" onclick="openPlayerCareerModal('${name.replace(/'/g, "\\'")}')"><b>${name}</b></span><br><small style="color:var(--muted);">${b.status}</small></td>
        <td class="text-right"><b>${b.runs}</b></td>
        <td class="text-right">${b.balls}</td>
        <td class="text-right">${b.fours}</td>
        <td class="text-right">${b.sixes}</td>
        <td class="text-right">${sr}</td>
      </tr>`;
    }
  });

  const bowlBody = document.getElementById('breakBowlingBody');
  bowlBody.innerHTML = '';
  const bsnapshot = match.innings1BowlingSnapshot || {};
  Object.keys(bsnapshot).forEach(name => {
    const bw = bsnapshot[name];
    if (bw.balls > 0) {
      const ovStr = `${Math.floor(bw.balls / 6)}.${bw.balls % 6}`;
      const eco = bw.balls > 0 ? (bw.runs / (bw.balls / 6)).toFixed(2) : '0.0';
      bowlBody.innerHTML += `<tr>
        <td><span class="player-link" onclick="openPlayerCareerModal('${name.replace(/'/g, "\\'")}')"><b>${name}</b></span></td>
        <td class="text-right">${ovStr}</td>
        <td class="text-right">${bw.maidens || 0}</td>
        <td class="text-right">${bw.runs}</td>
        <td class="text-right"><b>${bw.wickets}</b></td>
        <td class="text-right">${eco}</td>
      </tr>`;
    }
  });

  const fowBox = document.getElementById('breakFowBody');
  if (match.innings1Fow && match.innings1Fow.length > 0) {
    fowBox.innerHTML = match.innings1Fow.map(f => `<div style="padding:3px 0;">${f}</div>`).join('');
  } else {
    fowBox.innerHTML = 'No wickets fell.';
  }

  document.getElementById('inningsBreakModal').style.display = 'flex';
  if (isCommentaryVoiceActive) speak(`First innings concluded. ${s.team} scored ${s.runs} for ${s.wickets}. ${match.teamBatting} need ${match.target} to win.`);
}

function proceedToSecondInningsSetup() {
  closeModal('inningsBreakModal');
  openInnings2Setup();
}

function endInningsPrompt() {
  if (!match.isActive || isViewerMode) return;
  const title = document.getElementById('endInningsTitle');
  const desc = document.getElementById('endInningsDesc');
  const score = document.getElementById('endInningsScore');
  const overs = document.getElementById('endInningsOvers');
  if (match.innings === 1) {
    title.innerText = 'End 1st Innings?';
    desc.innerText = `${match.teamBatting} will be finalized and ${match.teamBowling} will chase.`;
    score.innerText = `${match.runs}/${match.wickets}`;
    overs.innerText = `${Math.floor(match.legalBalls / 6)}.${match.legalBalls % 6} overs`;
  } else {
    title.innerText = 'End 2nd Innings?';
    desc.innerText = `Match will end. Winner will be declared.`;
    score.innerText = `${match.runs}/${match.wickets}`;
    overs.innerText = `${Math.floor(match.legalBalls / 6)}.${match.legalBalls % 6} overs (Target: ${match.target})`;
  }
  document.getElementById('endInningsModal').style.display = 'flex';
}

function confirmEndInnings() {
  closeModal('endInningsModal');
  if (match.innings === 1) {
    saveInnings1Snapshot();
    transitionToInnings2();
    showInningsBreakModal();
  } else {
    endMatchAndDeclareWinner(true);
  }
}

function openInnings2Setup() {
  const bat = savedTeams.find(t => t.name === match.teamBatting) || { name: match.teamBatting, squad: [] };
  const bowl = savedTeams.find(t => t.name === match.teamBowling) || { name: match.teamBowling, squad: [] };
  const bo = (bat.squad || []).map(p => `<option value="${p}">${p}</option>`).join('') || '<option value="">-- No players --</option>';
  const wo = (bowl.squad || []).map(p => `<option value="${p}">${p}</option>`).join('') || '<option value="">-- No players --</option>';

  document.getElementById('i2Subtitle').innerText = `${bat.name} need ${match.target} to win`;
  document.getElementById('i2Striker').innerHTML = bo;
  document.getElementById('i2NonStriker').innerHTML = bo;
  document.getElementById('i2Bowler').innerHTML = wo;
  document.getElementById('i2StrikerNew').value = '';
  document.getElementById('i2NonStrikerNew').value = '';
  document.getElementById('i2BowlerNew').value = '';
  document.getElementById('i2Modal').style.display = 'flex';
}

function beginSecondInnings() {
  const s = autoCapitalize((document.getElementById('i2StrikerNew').value || document.getElementById('i2Striker').value || '').trim());
  const ns = autoCapitalize((document.getElementById('i2NonStrikerNew').value || document.getElementById('i2NonStriker').value || '').trim());
  const b = autoCapitalize((document.getElementById('i2BowlerNew').value || document.getElementById('i2Bowler').value || '').trim());

  if (!s || !ns || !b) return alert("Select all players");
  if (s.toLowerCase() === ns.toLowerCase()) return alert("Must be different");

  if (document.getElementById('i2StrikerNew').value.trim()) autoAddPlayerToTeam(s, match.teamBatting);
  if (document.getElementById('i2NonStrikerNew').value.trim()) autoAddPlayerToTeam(ns, match.teamBatting);
  if (document.getElementById('i2BowlerNew').value.trim()) autoAddPlayerToTeam(b, match.teamBowling);

  const bat = savedTeams.find(t => t.name === match.teamBatting) || { squad: [] };
  const bowl = savedTeams.find(t => t.name === match.teamBowling) || { squad: [] };

  match.batters = {};
  match.bowlers = {};

  [...new Set([...(bat.squad || []), s, ns])].forEach(p => {
    match.batters[p] = { runs: 0, balls: 0, fours: 0, sixes: 0, dots: 0, fifties: 0, hundreds: 0, status: "dnb" };
    match.playerTeamMap[p] = match.teamBattingAbbr;
  });
  match.batters[s].status = "batting";
  match.batters[ns].status = "batting";

  [...new Set([...(bowl.squad || []), b])].forEach(p => {
    match.bowlers[p] = { balls: 0, maidens: 0, runs: 0, wickets: 0, dots: 0, threeW: 0, fiveW: 0 };
    match.playerTeamMap[p] = match.teamBowlingAbbr;
  });

  match.striker = s;
  match.nonStriker = ns;
  match.currentBowler = b;
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
    if (match.runs >= match.target) {
      winner = i2t;
      margin = `${i2t} won by ${10 - match.wickets} wkts`;
    } else if (match.runs === first.runs) {
      winner = 'tie';
      margin = 'Match tied';
    } else {
      winner = i1t;
      margin = `${i1t} won by ${first.runs - match.runs} runs`;
    }
  }

  const entry = {
    fixture: `${i1t} vs ${i2t}`,
    result: margin,
    venue: match.venue,
    date: new Date().toLocaleDateString(),
    teamA: i1t,
    teamB: i2t,
    winner: winner,
    innings1: {
      team: i1t,
      runs: first ? first.runs : 0,
      wickets: first ? first.wickets : 0,
      balls: first ? first.balls : 0,
      batters: match.innings1BattingSnapshot || {},
      bowlers: match.innings1BowlingSnapshot || {},
      fielding: match.innings1FieldingSnapshot || {}
    },
    innings2: {
      team: i2t,
      runs: match.runs,
      wickets: match.wickets,
      balls: match.legalBalls,
      batters: JSON.parse(JSON.stringify(match.batters)),
      bowlers: JSON.parse(JSON.stringify(match.bowlers)),
      fielding: JSON.parse(JSON.stringify(match.fielding))
    }
  };

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
      document.getElementById('resultWinner').innerText = winner === 'tie' ? 'Match Tied' : `🏆 ${winner}`;
      document.getElementById('resultMargin').innerText = margin;
      document.getElementById('resultScores').innerHTML = `
        <div style="display:flex;justify-content:space-between;padding:10px;background:rgba(255,255,255,.04);border-radius:8px;margin-bottom:8px;">
          <span>${i1t}</span><b>${i1s}</b>
        </div>
        <div style="display:flex;justify-content:space-between;padding:10px;background:rgba(255,255,255,.04);border-radius:8px;">
          <span>${i2t}</span><b>${i2s}</b>
        </div>`;
      document.getElementById('resultModal').style.display = 'flex';
      const ub = document.getElementById('undoBtn');
      if (ub) ub.style.display = 'none';
      const sb = document.getElementById('btnSoundToggle');
      if (sb) sb.style.display = 'none';

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

/* ============ LIVE DASHBOARD RENDERING ============ */
function renderLive() {
  if (!match.teamBatting) return;
  const ov = `${Math.floor(match.legalBalls / 6)}.${match.legalBalls % 6}`;
  const crr = match.legalBalls > 0 ? (match.runs / (match.legalBalls / 6)).toFixed(2) : "0.00";
  const st = document.getElementById('liveScoreText');
  if (st) {
    st.innerHTML = `<span class="team-name">${match.teamBatting}</span><span class="score-num">${match.runs}/${match.wickets}</span> <span style="font-size:15px;color:var(--muted);">(${ov})</span>`;
  }
  const crrVal = document.getElementById('crrVal');
  if (crrVal) crrVal.innerText = crr;

  const ub = document.getElementById('undoBtn');
  if (ub) ub.disabled = historyStack.length === 0 || isViewerMode;

  if (match.innings === 2) {
    const bl = (match.totalOvers * 6) - match.legalBalls;
    const rn = Math.max(0, match.target - match.runs);
    const rrrVal = document.getElementById('rrrVal');
    if (rrrVal) rrrVal.innerText = bl > 0 ? (rn / (bl / 6)).toFixed(2) : '0.00';
  }

  const s = match.batters[match.striker] || { runs: 0, balls: 0, fours: 0, sixes: 0 };
  const ns = match.batters[match.nonStriker] || { runs: 0, balls: 0, fours: 0, sixes: 0 };

  const strikerNameEl = document.getElementById('strikerName');
  if (strikerNameEl) strikerNameEl.innerHTML = `<span class="player-link" onclick="openPlayerCareerModal('${match.striker.replace(/'/g, "\\'")}')">${match.striker}*</span>`;
  if (document.getElementById('strikerRuns')) document.getElementById('strikerRuns').innerText = `${s.runs} (${s.balls})`;
  if (document.getElementById('strikerSR')) document.getElementById('strikerSR').innerText = s.balls > 0 ? ((s.runs / s.balls) * 100).toFixed(1) : "0.0";
  if (document.getElementById('striker4s')) document.getElementById('striker4s').innerText = s.fours;
  if (document.getElementById('striker6s')) document.getElementById('striker6s').innerText = s.sixes;

  const nonStrikerNameEl = document.getElementById('nonStrikerName');
  if (nonStrikerNameEl) nonStrikerNameEl.innerHTML = `<span class="player-link" onclick="openPlayerCareerModal('${match.nonStriker.replace(/'/g, "\\'")}')">${match.nonStriker}</span>`;
  if (document.getElementById('nonStrikerRuns')) document.getElementById('nonStrikerRuns').innerText = `${ns.runs} (${ns.balls})`;
  if (document.getElementById('nonStrikerSR')) document.getElementById('nonStrikerSR').innerText = ns.balls > 0 ? ((ns.runs / ns.balls) * 100).toFixed(1) : "0.0";
  if (document.getElementById('nonStriker4s')) document.getElementById('nonStriker4s').innerText = ns.fours;
  if (document.getElementById('nonStriker6s')) document.getElementById('nonStriker6s').innerText = ns.sixes;

  const bw = match.bowlers[match.currentBowler] || { balls: 0, maidens: 0, runs: 0, wickets: 0 };
  const bowlerNameEl = document.getElementById('bowlerName');
  if (bowlerNameEl) bowlerNameEl.innerHTML = `<span class="player-link" onclick="openPlayerCareerModal('${match.currentBowler.replace(/'/g, "\\'")}')">${match.currentBowler}</span>`;
  if (document.getElementById('bowlerFigures')) document.getElementById('bowlerFigures').innerText = `${Math.floor(bw.balls / 6)}.${bw.balls % 6}-${bw.maidens}-${bw.runs}-${bw.wickets}`;
  if (document.getElementById('bowlerEco')) document.getElementById('bowlerEco').innerText = bw.balls > 0 ? (bw.runs / (bw.balls / 6)).toFixed(2) : "0.00";

  const oc = document.getElementById('overCommentaryStrip');
  if (oc) {
    oc.innerHTML = '';
    if (match.currentOverBalls.length > 0) {
      const b = document.createElement('div');
      b.className = 'over-block';
      b.innerHTML = `<div class="over-block-num">Current</div><div class="over-block-balls">${match.currentOverBalls.map(x => `<span class="ball-pill" style="width:22px;height:22px;font-size:9px;">${x}</span>`).join('')}</div>`;
      oc.appendChild(b);
    }
  }

  renderScorecard();
  renderSummary();
  const _tvMode = document.getElementById('tvMode');
  if (_tvMode && _tvMode.classList.contains('active')) renderTVMode();
}

function renderCommentary() {
  const c = document.getElementById('commentaryContainer');
  if (!c) return;
  if (!match.commentary || match.commentary.length === 0) {
    c.innerHTML = `<div class="empty-comm">No deliveries yet.</div>`;
    return;
  }
  c.innerHTML = '';
  match.commentary.slice(0, 40).forEach((comm, idx) => {
    if (comm.type === 'summary') {
      const it = document.createElement('div');
      it.className = 'comm-item comm-summary' + (idx === 0 ? ' newest' : '');
      it.innerHTML = `<span class="comm-summary-icon">📊</span><div class="comm-summary-text">${comm.desc}</div>`;
      c.appendChild(it);
      return;
    }
    const tc = comm.type === 'w' ? 'w' : (comm.type === 'four' ? 'four' : (comm.type === 'six' ? 'six' : ''));
    const it = document.createElement('div');
    it.className = 'comm-item' + (idx === 0 ? ' newest' : '');
    it.innerHTML = `<div class="comm-ball ${tc}">${comm.ball}</div><div class="comm-body"><div class="comm-over">Over ${comm.ball}</div><div class="comm-text">${comm.desc}</div></div>`;
    c.appendChild(it);
  });
}

function renderSummary() {
  const cp = match.currentPartnership || { runs: 0, balls: 0, batters: [] };
  const st = match.batters[match.striker] || { runs: 0, balls: 0 };
  const nst = match.batters[match.nonStriker] || { runs: 0, balls: 0 };
  const pr = document.getElementById('partRuns');
  const pd = document.getElementById('partDetails');
  const fw = document.getElementById('fowContainer');

  if (pr) pr.innerText = `${cp.runs || 0} runs (${cp.balls || 0} balls)`;
  if (pd) pd.innerText = `${match.striker || '-'}: ${st.runs} (${st.balls}) | ${match.nonStriker || '-'}: ${nst.runs} (${nst.balls})`;
  if (fw) fw.innerHTML = (match.fow && match.fow.length > 0) ? match.fow.join('<br>') : 'No wickets yet.';
}

function renderScorecard() {
  try {
    const bt = document.getElementById('battingTeamTitle'); if (bt) bt.innerText = 'Batting — ' + (match.teamBatting || '');
    const bwt = document.getElementById('bowlingTeamTitle'); if (bwt) bwt.innerText = 'Bowling — ' + (match.teamBowling || '');
    const bb = document.getElementById('battingTableBody');
    if (bb) {
      bb.innerHTML = '';
      for (const n in match.batters) {
        const b = match.batters[n];
        if (b.status && b.status !== 'dnb') {
          const sr = b.balls > 0 ? ((b.runs / b.balls) * 100).toFixed(1) : '0.0';
          bb.innerHTML += `<tr>
            <td><b>${n}${n === match.striker ? ' *' : ''}</b><br><small style="color:var(--muted);">${b.status || ''}</small></td>
            <td class="text-right"><b>${b.runs}</b></td>
            <td class="text-right">${b.balls}</td>
            <td class="text-right">${b.fours}</td>
            <td class="text-right">${b.sixes}</td>
            <td class="text-right">${sr}</td>
          </tr>`;
        }
      }
    }
    const bl = document.getElementById('bowlingTableBody');
    if (bl) {
      bl.innerHTML = '';
      for (const n in match.bowlers) {
        const b = match.bowlers[n];
        if (b.balls > 0 || n === match.currentBowler) {
          const ov = Math.floor(b.balls / 6) + '.' + (b.balls % 6);
          const eco = b.balls > 0 ? (b.runs / (b.balls / 6)).toFixed(2) : '0.0';
          bl.innerHTML += `<tr>
            <td><b>${n}${n === match.currentBowler ? ' *' : ''}</b></td>
            <td class="text-right">${ov}</td>
            <td class="text-right">${b.maidens}</td>
            <td class="text-right">${b.runs}</td>
            <td class="text-right"><b>${b.wickets}</b></td>
            <td class="text-right">${eco}</td>
          </tr>`;
        }
      }
    }
  } catch (e) {
    console.warn('renderScorecard error:', e);
  }
}

function swapStrikers() {
  const t = match.striker;
  match.striker = match.nonStriker;
  match.nonStriker = t;
  renderLive();
}

function undoDelivery() {
  if (historyStack.length > 0 && !isViewerMode) {
    match = historyStack.pop();
    window.match = match;
    autoPersist();
    renderLive();
    renderCommentary();
    broadcastMatchState();
  }
}

/* ============ NZC ANALYTICS ============ */
function renderNzcAnalytics() {
  const t1El = document.getElementById('nzcLegendTeam1');
  const t2El = document.getElementById('nzcLegendTeam2');
  if (t1El) t1El.innerText = match.innings1Score?.team || match.teamBatting || 'Team 1';
  if (t2El) t2El.innerText = (match.innings === 2 ? match.teamBatting : match.teamBowling) || 'Team 2';
  renderNzcRunChart();
  renderNzcPartnerships();
  renderNzcWagon();
}

function switchRunChart(mode) {
  nzcRunChartMode = mode;
  document.getElementById('btnManhattan').classList.toggle('active', mode === 'manhattan');
  document.getElementById('btnWorm').classList.toggle('active', mode === 'worm');
  renderNzcRunChart();
}

function switchWagonTeam(inn) {
  nzcWagonInnings = inn;
  document.getElementById('teamToggle1').classList.toggle('active', inn === 1);
  document.getElementById('teamToggle2').classList.toggle('active', inn === 2);
  renderNzcWagon();
}

function renderNzcRunChart() {
  const canvas = document.getElementById('runChartCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const isDark = !document.body.classList.contains('light-mode');
  ctx.clearRect(0, 0, W, H);

  const padding = { left: 55, right: 20, top: 20, bottom: 45 };
  const chartW = W - padding.left - padding.right;
  const chartH = H - padding.top - padding.bottom;
  const totalOv = match.totalOvers || 20;

  const overRunsPerInns = { 1: new Array(totalOv).fill(0), 2: new Array(totalOv).fill(0) };
  const overWicketsPerInns = { 1: new Array(totalOv).fill(0), 2: new Array(totalOv).fill(0) };
  const cumulativePerInns = { 1: new Array(totalOv + 1).fill(0), 2: new Array(totalOv + 1).fill(0) };
  const wicketsAtInns = { 1: [], 2: [] };

  (match.shotLog || []).forEach(s => {
    if (!s.over || s.over < 1 || s.over > totalOv) return;
    const ovIdx = s.over - 1;
    let r = s.runs || 0;
    if (s.extra === 'WD' || s.extra === 'NB') r += 1;
    overRunsPerInns[s.inns][ovIdx] += r;
    if (s.isWicket) overWicketsPerInns[s.inns][ovIdx] += 1;
  });

  for (const inn of [1, 2]) {
    let cum = 0;
    for (let i = 0; i < totalOv; i++) {
      cum += overRunsPerInns[inn][i];
      cumulativePerInns[inn][i + 1] = cum;
      if (overWicketsPerInns[inn][i] > 0) {
        for (let w = 0; w < overWicketsPerInns[inn][i]; w++) {
          wicketsAtInns[inn].push({ over: i + 1, cum: cum });
        }
      }
    }
  }

  ctx.strokeStyle = isDark ? 'rgba(255,255,255,.08)' : '#e5e7eb';
  ctx.lineWidth = 1;
  ctx.font = '11px -apple-system, sans-serif';
  ctx.fillStyle = isDark ? '#94a3b8' : '#64748b';

  const maxRuns = Math.max(
    cumulativePerInns[1][totalOv] || 0,
    cumulativePerInns[2][totalOv] || 0,
    ...overRunsPerInns[1],
    ...overRunsPerInns[2],
    10
  );

  if (nzcRunChartMode === 'manhattan') {
    const yMax = Math.ceil(maxRuns / 4) * 4 + 4;
    for (let i = 0; i <= 5; i++) {
      const v = Math.round((yMax / 5) * i);
      const y = H - padding.bottom - (chartH * i) / 5;
      ctx.fillText(v, 12, y + 4);
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(W - padding.right, y);
      ctx.stroke();
    }
    for (let i = 1; i <= totalOv; i++) {
      const x = padding.left + (chartW * (i - 0.5)) / totalOv;
      if (totalOv <= 20 || i % Math.ceil(totalOv / 10) === 0) ctx.fillText(i, x - 5, H - padding.bottom + 16);
    }
    ctx.fillText('Overs', W / 2 - 20, H - 8);

    const gap = 2;
    const groupW = chartW / totalOv;
    const barW = (groupW - gap * 3) / 2;
    for (let i = 0; i < totalOv; i++) {
      const groupX = padding.left + i * groupW + gap;
      const r1 = overRunsPerInns[1][i];
      if (r1 > 0) {
        const h1 = (chartH * r1) / yMax;
        ctx.fillStyle = isDark ? '#f8fafc' : '#1e293b';
        ctx.fillRect(groupX, H - padding.bottom - h1, barW, h1);
      }
      const r2 = overRunsPerInns[2][i];
      if (r2 > 0) {
        const h2 = (chartH * r2) / yMax;
        ctx.fillStyle = '#a855f7';
        ctx.fillRect(groupX + barW + gap, H - padding.bottom - h2, barW, h2);
      }
      const totalWkts = overWicketsPerInns[1][i] + overWicketsPerInns[2][i];
      if (totalWkts > 0) {
        const maxH = Math.max((chartH * r1) / yMax, (chartH * r2) / yMax);
        const cx = groupX + groupW / 2 - gap;
        const cy = H - padding.bottom - maxH - 10;
        ctx.fillStyle = '#a855f7';
        ctx.beginPath();
        ctx.arc(cx, cy, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('W', cx, cy + 4);
        ctx.textAlign = 'left';
        ctx.font = '11px -apple-system, sans-serif';
      }
    }
  } else {
    const yMax = Math.ceil(maxRuns / 20) * 20 + 20;
    for (let i = 0; i <= 5; i++) {
      const v = Math.round((yMax / 5) * i);
      const y = H - padding.bottom - (chartH * i) / 5;
      ctx.fillText(v, 12, y + 4);
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(W - padding.right, y);
      ctx.stroke();
    }
    for (let i = 1; i <= totalOv; i++) {
      if (totalOv <= 20 || i % Math.ceil(totalOv / 10) === 0) {
        const x = padding.left + (chartW * (i - 0.5)) / totalOv;
        ctx.fillText(i, x - 5, H - padding.bottom + 16);
      }
    }
    ctx.fillText('Overs', W / 2 - 20, H - 8);

    const plotLine = (data, color) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let i = 0; i <= totalOv; i++) {
        const x = padding.left + (chartW * i) / totalOv;
        const y = H - padding.bottom - (chartH * data[i]) / yMax;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    };

    plotLine(cumulativePerInns[1], isDark ? '#f8fafc' : '#1e293b');
    if (match.innings === 2 || cumulativePerInns[2][totalOv] > 0) {
      plotLine(cumulativePerInns[2], '#a855f7');
    }

    for (const inn of [1, 2]) {
      wicketsAtInns[inn].forEach(w => {
        const x = padding.left + (chartW * w.over) / totalOv;
        const y = H - padding.bottom - (chartH * w.cum) / yMax;
        ctx.fillStyle = '#a855f7';
        ctx.beginPath();
        ctx.arc(x, y, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('W', x, y + 4);
        ctx.textAlign = 'left';
        ctx.font = '11px -apple-system, sans-serif';
      });
    }
  }
}

function renderNzcPartnerships() {
  const c = document.getElementById('nzcPartnershipsList');
  if (!c) return;
  const parts = [...match.partnerRuns];
  const current = match.currentPartnership || { runs: 0, balls: 0, batters: [] };
  if (current.runs > 0 || current.balls > 0 || match.isActive) parts.push(current);

  if (parts.length === 0) {
    c.innerHTML = '<div style="text-align:center;color:var(--muted);font-size:12px;padding:20px;">No partnerships recorded yet.</div>';
    return;
  }

  const max = Math.max(...parts.map(p => p.runs), 1);
  let html = '';
  parts.forEach((p, i) => {
    const w = Math.round((p.runs / max) * 100);
    const names = p.batters && p.batters.length ? p.batters.join(' & ') : `Partnership ${i + 1}`;
    html += `<div class="nzc-part-row">
      <div style="min-width:110px;font-size:11px;color:var(--muted);">${names}</div>
      <div class="nzc-part-bar"><div class="nzc-part-fill" style="width:${w}%"></div></div>
      <div style="min-width:70px;text-align:right;"><b>${p.runs}</b> <span style="color:var(--muted);font-size:10px;">(${p.balls || 0}b)</span></div>
    </div>`;
  });
  c.innerHTML = html;
}

function switchWagonMode(mode) {
  nzcWagonMode = mode;
  document.getElementById('wagonTabWagon').classList.toggle('active', mode === 'wagon');
  document.getElementById('wagonTabSpider').classList.toggle('active', mode === 'spider');
  document.getElementById('wagonTabCatch').classList.toggle('active', mode === 'catch');
  document.getElementById('nzcWagonLegend').style.display = (mode === 'spider') ? 'flex' : 'none';
  renderNzcWagon();
}

function renderNzcWagon() {
  const canvas = document.getElementById('nzcWagonCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const cx = W / 2, cy = H / 2;
  const R = Math.min(W, H) / 2 - 30;
  const isDark = !document.body.classList.contains('light-mode');
  ctx.clearRect(0, 0, W, H);

  const fieldGrad = ctx.createRadialGradient(cx, cy, R * 0.1, cx, cy, R);
  if (isDark) {
    fieldGrad.addColorStop(0, 'rgba(34,90,45,.55)');
    fieldGrad.addColorStop(1, 'rgba(20,60,30,.7)');
  } else {
    fieldGrad.addColorStop(0, '#c8e6c9');
    fieldGrad.addColorStop(1, '#a5d6a7');
  }
  ctx.fillStyle = fieldGrad;
  ctx.beginPath();
  ctx.ellipse(cx, cy, R, R * 1.05, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = isDark ? 'rgba(255,255,255,.55)' : 'rgba(255,255,255,.9)';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 5]);
  ctx.beginPath();
  ctx.ellipse(cx, cy, R * 0.98, R * 1.03, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.strokeStyle = isDark ? 'rgba(255,255,255,.35)' : 'rgba(255,255,255,.8)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(cx, cy, R * 0.6, R * 0.63, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = '#e0c9a6';
  ctx.fillRect(cx - 7, cy - 35, 14, 70);
  ctx.fillStyle = '#8b4513';
  ctx.fillRect(cx - 3, cy - 38, 6, 4);
  ctx.fillRect(cx - 3, cy + 34, 6, 4);

  const filteredShots = (match.shotLog || []).filter(s => s.inns === nzcWagonInnings);
  const sectorAngles = [-Math.PI / 8, Math.PI / 8, 3 * Math.PI / 8, 5 * Math.PI / 8, 7 * Math.PI / 8, 9 * Math.PI / 8, 11 * Math.PI / 8, 13 * Math.PI / 8];

  if (nzcWagonMode === 'wagon') {
    const sectorRuns = new Array(8).fill(0);
    filteredShots.forEach(s => {
      if (!s.zone || s.zoneIndex < 0) return;
      sectorRuns[s.zoneIndex] += s.runs;
    });
    const maxRuns = Math.max(...sectorRuns, 1);
    for (let i = 0; i < 8; i++) {
      const a0 = sectorAngles[i];
      const a1 = a0 + Math.PI / 4;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, R * 0.75, a0, a1);
      ctx.closePath();
      const intensity = sectorRuns[i] / maxRuns;
      ctx.fillStyle = `rgba(255,152,0,${0.15 + intensity * 0.55})`;
      ctx.fill();
      ctx.strokeStyle = isDark ? 'rgba(255,255,255,.25)' : 'rgba(255,255,255,.7)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a0) * R * 0.75, cy + Math.sin(a0) * R * 0.75);
      ctx.stroke();
    }
    for (let i = 0; i < 8; i++) {
      const midAngle = sectorAngles[i] + Math.PI / 8;
      const bx = cx + Math.cos(midAngle) * R * 0.55;
      const by = cy + Math.sin(midAngle) * R * 0.55;
      ctx.fillStyle = isDark ? 'rgba(255,255,255,.95)' : '#fff';
      ctx.beginPath();
      ctx.roundRect(bx - 18, by - 13, 36, 26, 5);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.15)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 14px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(sectorRuns[i], bx, by + 5);
      ctx.textAlign = 'left';
    }
    const sum = document.getElementById('nzcWagonSummary');
    if (sum) sum.innerText = `${filteredShots.length} shots • ${filteredShots.reduce((a, b) => a + b.runs, 0)} runs • ${filteredShots.filter(s => s.isBoundary).length} boundaries`;
  } else if (nzcWagonMode === 'spider') {
    filteredShots.forEach(s => {
      if (!s.zone || s.zoneIndex < 0) return;
      const baseAngle = sectorAngles[s.zoneIndex] + Math.PI / 8;
      const jitter = (Math.random() - 0.5) * 0.35;
      const angle = baseAngle + jitter;
      let len;
      let isSixFlight = false;
      if (s.isSix) {
        const d = (typeof s.distance === 'number' && s.distance > 0) ? s.distance : 75;
        const distRatio = Math.max(0, Math.min(1, (d - 75) / 45));
        len = R * (1.05 + distRatio * 0.08);
        isSixFlight = true;
      } else if (s.isFour) {
        len = R * 0.95;
      } else {
        len = R * (0.3 + Math.random() * 0.4);
      }
      const ex = cx + Math.cos(angle) * len;
      const ey = cy + Math.sin(angle) * len;
      let color = '#94a3b8';
      if (s.isSix) color = '#d946ef';
      else if (s.isFour) color = '#22d3ee';

      ctx.strokeStyle = color;
      ctx.lineWidth = s.isBoundary ? 2 : 1.2;
      ctx.globalAlpha = s.isBoundary ? 1 : 0.7;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      ctx.globalAlpha = 1;

      if (isSixFlight) {
        ctx.save();
        ctx.fillStyle = '#ff0000';
        ctx.shadowColor = '#ff0000';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(ex, ey, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
        if (s.distance) {
          ctx.fillStyle = isDark ? '#f8fafc' : '#0f172a';
          ctx.font = 'bold 10px -apple-system, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(s.distance + 'm', ex, ey - 10);
          ctx.textAlign = 'left';
        }
      }
    });
    const sum = document.getElementById('nzcWagonSummary');
    if (sum) sum.innerText = `${filteredShots.length} shots • ${filteredShots.filter(s => s.isBoundary).length} boundaries`;
  } else if (nzcWagonMode === 'catch') {
    const wickets = filteredShots.filter(s => s.isWicket);
    wickets.forEach(w => {
      let baseAngle = -Math.PI / 2;
      if (w.zoneIndex >= 0) baseAngle = sectorAngles[w.zoneIndex] + Math.PI / 8;
      const jitter = (Math.random() - 0.5) * 0.4;
      const angle = baseAngle + jitter;
      const radius = R * (0.5 + Math.random() * 0.4);
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;
      ctx.fillStyle = isDark ? '#0f172a' : '#000';
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });
    const sum = document.getElementById('nzcWagonSummary');
    if (sum) sum.innerText = `${wickets.length} wicket${wickets.length !== 1 ? 's' : ''} • Innings ${nzcWagonInnings}`;
  }
}

/* ============ EXPORTS ============ */
function exportCommentaryPDF() {
  if (!window.jspdf) return alert("PDF library loading...");
  if (!match.commentary || match.commentary.length === 0) return alert("No commentary to export.");
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.setFillColor(10, 14, 26);
  doc.rect(0, 0, 210, 32, 'F');
  doc.setTextColor(0, 230, 118);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('CRICMAX PRO — MATCH COMMENTARY', 14, 16);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.text(`${match.teamBatting} vs ${match.teamBowling} | ${match.venue}`, 14, 25);
  let y = 40;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  doc.text(`Score: ${match.teamBatting} ${match.runs}/${match.wickets} (${Math.floor(match.legalBalls / 6)}.${match.legalBalls % 6})`, 14, y);
  y += 8;
  doc.setFontSize(8);
  match.commentary.forEach(c => {
    if (y > 275) { doc.addPage(); y = 20; }
    if (c.type === 'summary') {
      doc.setTextColor(34, 211, 238);
      doc.setFont('helvetica', 'italic');
      const sp = doc.splitTextToSize(String(c.desc).replace(/<[^>]+>/g, ' '), 150);
      doc.text(sp, 14, y);
      y += sp.length * 3.5 + 2.5;
      return;
    }
    doc.setTextColor(0, 146, 112);
    doc.setFont('helvetica', 'bold');
    doc.text(`[${c.ball}]`, 14, y);
    doc.setTextColor(40, 40, 40);
    doc.setFont('helvetica', 'normal');
    const sp = doc.splitTextToSize(c.desc, 150);
    doc.text(sp, 35, y);
    y += sp.length * 4 + 3.5;
  });
  doc.save(`CricMax_Commentary_${match.teamBattingAbbr || 'Match'}.pdf`);
}

function exportStatsReportPDF() {
  if (!window.jspdf) return alert("PDF library loading...");
  const pool = buildStatsPool();
  if (!pool.length) return alert("No stats available to export yet.");
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const PW = 210, PH = 297, LM = 14, RM = 196;
  let y = 0;

  const header = () => {
    doc.setFillColor(10, 14, 26);
    doc.rect(0, 0, PW, 32, 'F');
    doc.setTextColor(0, 230, 118);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text('CRICMAX PRO — COMPLETE STATS REPORT', LM, 15);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`${match.teamBatting} vs ${match.teamBowling}   |   ${match.venue || ''}   |   ${new Date().toLocaleDateString()}`, LM, 23);
    doc.text(`${match.teamBatting} ${match.runs}/${match.wickets}  (${Math.floor(match.legalBalls / 6)}.${match.legalBalls % 6} ov)`, LM, 28);
    doc.setTextColor(0, 0, 0);
    y = 42;
  };

  const ensure = (need) => {
    if (y + need > PH - 16) {
      doc.addPage();
      header();
      return true;
    }
    return false;
  };

  const sectionTitle = (t) => {
    ensure(22);
    doc.setFillColor(0, 146, 112);
    doc.rect(LM, y - 5.5, RM - LM, 9, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(t, LM + 2, y + 1);
    doc.setTextColor(0, 0, 0);
    y += 11;
  };

  const drawTable = (cols, rows, emptyMsg) => {
    const head = () => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(90);
      cols.forEach(c => doc.text(c.label, c.x, y, { align: c.align || 'left' }));
      y += 3;
      doc.setDrawColor(190);
      doc.line(LM, y, RM, y);
      y += 4.5;
      doc.setTextColor(0);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
    };
    ensure(22);
    head();
    if (!rows.length) {
      doc.setTextColor(150);
      doc.text(emptyMsg || 'No data available', LM + 2, y);
      doc.setTextColor(0);
      y += 8;
      return;
    }
    rows.forEach(r => {
      if (y + 6 > PH - 16) {
        doc.addPage();
        header();
        head();
      }
      cols.forEach(c => {
        const v = typeof c.val === 'function' ? c.val(r) : (r[c.key] !== undefined ? r[c.key] : '');
        doc.text(String(v), c.x, y, { align: c.align || 'left' });
      });
      y += 5;
    });
    y += 5;
  };

  header();
  sectionTitle('MATCH SUMMARY');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const sumLines = [];
  if (match.innings1Score) {
    const i1 = match.innings1Score;
    sumLines.push(`${i1.team}:  ${i1.runs}/${i1.wickets}   (${Math.floor(i1.balls / 6)}.${i1.balls % 6} ov)`);
  }
  sumLines.push(`${match.teamBatting}:  ${match.runs}/${match.wickets}   (${Math.floor(match.legalBalls / 6)}.${match.legalBalls % 6} ov)`);
  if (match.innings === 2 && match.target) sumLines.push(`Target: ${match.target}`);
  sumLines.push(`Venue: ${match.venue || '-'}   |   Overs: ${match.totalOvers}`);
  sumLines.forEach(l => {
    ensure(8);
    doc.text(l, LM + 2, y);
    y += 5;
  });
  y += 5;

  const mvpRows = [...pool].sort((a, b) => b.mvp - a.mvp).slice(0, 10);
  sectionTitle('1. MVP LEADERBOARD (TOP 10)');
  drawTable([{ label: '#', x: 16, val: (r) => mvpRows.indexOf(r) + 1 }, { label: 'Player', x: 26, key: 'name' }, { label: 'Team', x: 92, key: 'team' }, { label: 'MVP', x: 128, align: 'right', key: 'mvp' }, { label: 'Runs', x: 150, align: 'right', key: 'runs' }, { label: 'Wkts', x: 166, align: 'right', key: 'wickets' }, { label: 'Ct', x: 184, align: 'right', key: 'catches' }], mvpRows);

  const runsRows = [...pool].sort((a, b) => b.runs - a.runs || b.sr - a.sr).slice(0, 10);
  sectionTitle('2. MOST RUNS (TOP 10)');
  drawTable([{ label: '#', x: 16, val: (r) => runsRows.indexOf(r) + 1 }, { label: 'Player', x: 26, key: 'name' }, { label: 'Team', x: 82, key: 'team' }, { label: 'Runs', x: 112, align: 'right', key: 'runs' }, { label: 'Balls', x: 130, align: 'right', key: 'balls' }, { label: '4s', x: 150, align: 'right', key: 'fours' }, { label: '6s', x: 168, align: 'right', key: 'sixes' }, { label: 'SR', x: 194, align: 'right', val: (r) => r.sr.toFixed(1) }], runsRows);

  const wktRows = [...pool].filter(p => p.bowlBalls > 0).sort((a, b) => b.wickets - a.wickets || a.eco - b.eco).slice(0, 10);
  sectionTitle('3. MOST WICKETS (TOP 10)');
  drawTable([{ label: '#', x: 16, val: (r) => wktRows.indexOf(r) + 1 }, { label: 'Player', x: 26, key: 'name' }, { label: 'Team', x: 90, key: 'team' }, { label: 'Wkts', x: 118, align: 'right', key: 'wickets' }, { label: 'Overs', x: 142, align: 'right', val: (r) => `${Math.floor(r.bowlBalls / 6)}.${r.bowlBalls % 6}` }, { label: 'Runs', x: 166, align: 'right', key: 'bowlRuns' }, { label: 'Eco', x: 194, align: 'right', val: (r) => r.eco.toFixed(2) }], wktRows, 'No bowling data yet');

  const batRows = [...pool].sort((a, b) => b.runs - a.runs);
  sectionTitle('4. FULL BATTING');
  drawTable([{ label: 'Player', x: 16, key: 'name' }, { label: 'Team', x: 70, key: 'team' }, { label: 'R', x: 100, align: 'right', key: 'runs' }, { label: 'B', x: 114, align: 'right', key: 'balls' }, { label: '4s', x: 128, align: 'right', key: 'fours' }, { label: '6s', x: 142, align: 'right', key: 'sixes' }, { label: 'SR', x: 162, align: 'right', val: (r) => r.sr.toFixed(1) }, { label: '50', x: 178, align: 'right', key: 'fifties' }, { label: '100', x: 194, align: 'right', key: 'hundreds' }], batRows);

  const bowlRows = [...pool].filter(p => p.bowlBalls > 0).sort((a, b) => b.wickets - a.wickets || a.eco - b.eco);
  sectionTitle('5. FULL BOWLING');
  drawTable([{ label: 'Player', x: 16, key: 'name' }, { label: 'Team', x: 64, key: 'team' }, { label: 'O', x: 92, align: 'right', val: (r) => `${Math.floor(r.bowlBalls / 6)}.${r.bowlBalls % 6}` }, { label: 'M', x: 106, align: 'right', key: 'maidens' }, { label: 'R', x: 120, align: 'right', key: 'bowlRuns' }, { label: 'W', x: 134, align: 'right', key: 'wickets' }, { label: 'Eco', x: 154, align: 'right', val: (r) => r.eco.toFixed(2) }, { label: 'Avg', x: 174, align: 'right', val: (r) => r.bowlAvg > 0 ? r.bowlAvg.toFixed(1) : '-' }, { label: 'SR', x: 194, align: 'right', val: (r) => r.bowlSR > 0 ? r.bowlSR.toFixed(1) : '-' }], bowlRows, 'No bowling data yet');

  doc.save(`CricMax_FullStats_${match.teamBattingAbbr || 'Match'}.pdf`);
}

function exportBallByBallCommentaryTXT() {
  if (!match.commentary || match.commentary.length === 0) return alert("No commentary.");
  let t = `CRICMAX PRO\n${match.teamBatting} vs ${match.teamBowling}\n${match.venue}\nScore: ${match.runs}/${match.wickets} (${Math.floor(match.legalBalls / 6)}.${match.legalBalls % 6} ov)\n\n`;
  match.commentary.forEach(c => {
    const txt = String(c.desc).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    t += `[${c.ball}] ${txt}\n`;
  });
  const blob = new Blob([t], { type: 'text/plain' });
  const u = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = u;
  a.download = `CricMax_Commentary.txt`;
  a.click();
  URL.revokeObjectURL(u);
}

function exportFullMatchStatsCSV() {
  const pool = buildStatsPool();
  if (!pool.length) return alert("No stats available yet.");
  let csv = '#,Player,Team,Status,Runs,Balls,4s,6s,50s,100s,SR,DotsFaced,Overs,Maidens,RunsConceded,Wickets,Eco,BowlAvg,BowlSR,3W,5W,Catches,Stumpings,RunOuts,TotalDismissals,MVP\n';
  pool.forEach((p, i) => {
    const ov = `${Math.floor(p.bowlBalls / 6)}.${p.bowlBalls % 6}`;
    csv += `${i + 1},"${p.name}","${p.team}","${p.status}",${p.runs},${p.balls},${p.fours},${p.sixes},${p.fifties},${p.hundreds},${p.sr.toFixed(2)},${p.dotsFaced},${ov},${p.maidens},${p.bowlRuns},${p.wickets},${p.eco === 99.9 ? '' : p.eco.toFixed(2)},${p.bowlAvg > 0 ? p.bowlAvg.toFixed(2) : ''},${p.bowlSR > 0 ? p.bowlSR.toFixed(2) : ''},${p.threeW},${p.fiveW},${p.catches},${p.stumpings},${p.runOuts},${p.totalDismissals},${p.mvp}\n`;
  });
  const blob = new Blob([csv], { type: 'text/csv' });
  const u = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = u;
  a.download = `CricMax_FullStats.csv`;
  a.click();
  URL.revokeObjectURL(u);
}

function exportCompleteMatchJSON() {
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
    exportedAt: new Date().toISOString()
  };
  const blob = new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' });
  const u = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = u;
  a.download = `CricMax_Match_${match.teamBattingAbbr || 'Match'}.json`;
  a.click();
  URL.revokeObjectURL(u);
}

function exportTournamentPointsCSV() {
  if (!pastMatchesLedger || pastMatchesLedger.length === 0) return alert("No matches recorded.");
  let csv = 'Fixture,Result,Venue,Date\n';
  pastMatchesLedger.forEach(pm => {
    csv += `"${pm.fixture}","${pm.result}","${pm.venue}","${pm.date}"\n`;
  });
  const blob = new Blob([csv], { type: 'text/csv' });
  const u = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = u;
  a.download = `CricMax_Tournament.csv`;
  a.click();
  URL.revokeObjectURL(u);
}

function exportScorecardImage() {
  if (!window.html2canvas) return alert("Image library loading...");
  const el = document.getElementById('pane-scorecard');
  const wasActive = el.classList.contains('active');
  if (!wasActive) {
    document.querySelectorAll('.sub-pane').forEach(p => p.classList.remove('active'));
    el.classList.add('active');
  }
  html2canvas(el, { backgroundColor: '#0b1220', scale: 2 }).then(canvas => {
    const u = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = u;
    a.download = `CricMax_Scorecard.png`;
    a.click();
    if (!wasActive) {
      el.classList.remove('active');
      selectSubPane('scorecard');
    }
  });
}

/* ============ CANVAS POLYFILL ============ */
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

/* ============ SETTINGS DROPDOWN INJECTOR ============ */
function setConfigFromSelect(key, val) {
  matchConfig[key] = parseInt(val, 10);
  if (isNaN(matchConfig[key])) matchConfig[key] = 0;
  autoPersist();
  updateSettingsSummary();
}

function upgradeSettingsDropdowns() {
  function makeDropdown(selectId, values, current, onChange) {
    let html = `<select class="form-control" id="${selectId}" onchange="${onChange}" style="width:100px;padding:6px 8px;font-size:13px;font-weight:800;background:rgba(0,0,0,.4);border:1px solid var(--card-border);color:#fff;">`;
    values.forEach(v => {
      html += `<option value="${v}"${v === current ? ' selected' : ''}>${v}</option>`;
    });
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

setTimeout(upgradeSettingsDropdowns, 300);

/* ============ KEYBOARD SHORTCUTS ============ */
document.addEventListener('keydown', e => {
  if (!match.isActive || isViewerMode) return;
  const k = e.key;
  if (['0', '1', '2', '3', '4', '6'].includes(k)) {
    const r = parseInt(k, 10);
    if (r === 0) recordBall(0);
    else promptWagonWheel(r);
  } else if (k === 'w' || k === 'W') {
    promptWicketTypeModal();
  } else if (k === 'u' || k === 'U') {
    undoDelivery();
  } else if (k === 's' || k === 'S') {
    openSettingsModal();
  }
});

/* ============ AUTO-CAPITALIZE ALL INPUTS ============ */
document.addEventListener('input', function (e) {
  const el = e.target;
  if (!el || !el.matches) return;
  if (!el.matches('input[type="text"], input:not([type])')) return;

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

/* ============ FULLSCREEN & REPLAY HELPERS ============ */
function toggleFullScreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(err => console.warn(err));
  } else {
    if (document.exitFullscreen) document.exitFullscreen();
  }
}

function triggerReplay() {
  if (!match.shotLog || match.shotLog.length === 0) {
    showToast('No balls to replay yet');
    return;
  }
  const lastShot = match.shotLog[match.shotLog.length - 1];

  // Dispatch to 3D stadium iframe if connected
  const stadiumFrame = document.getElementById('stadiumIframe') || document.querySelector('iframe');
  if (stadiumFrame && stadiumFrame.contentWindow) {
    stadiumFrame.contentWindow.postMessage({
      type: 'TRIGGER_DELIVERY',
      shot: Object.assign({}, lastShot, { isReplay: true })
    }, '*');
  }

  if (typeof window.vppPlayDelivery === 'function') {
    window.vppPlayDelivery(lastShot);
  } else if (typeof window.playBallAnimation === 'function') {
    window.playBallAnimation(lastShot);
  } else {
    showToast(`Replaying Ball ${lastShot.over}.${lastShot.ball}: ${lastShot.runs} runs`);
  }
}

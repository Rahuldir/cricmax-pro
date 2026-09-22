/* ============================================================
   state.js — Application state, config, empty match,
              + normalizeMatch() for self-healing remote data
   ⚠️ NEVER deletes user data automatically.
   ============================================================ */

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

let pendingMatchOvers = 0;
let pendingMatchVenue = '';

let statsScope = 'live';
let commentaryDensity = 'boundaries';
let _renderScheduled = false;
let viewerCountUnsub = null;
let viewerPresenceDocRef = null;

const MAX_UNDO = 100;

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

/* ═══════════════════════════════════════════════════════════
   EMPTY MATCH BLUEPRINT
   ═══════════════════════════════════════════════════════════ */
function emptyMatch() {
  return {
    isActive: false,
    innings: 1,
    totalOvers: 20,
    originalOvers: 20,
    totalOversLocked: false,
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
    innings1FieldingSnapshot: null,
    _currentOverRuns: 0,
    _lastOverRuns: 0,
    motm: null
  };
}

let match = emptyMatch();
window.match = match;

/* ═══════════════════════════════════════════════════════════
   NORMALIZE MATCH — self-heals incomplete remote/local data.
   Safe to call anytime. Returns the same object (mutated).
   ═══════════════════════════════════════════════════════════ */
function normalizeMatch(m) {
  if (!m || typeof m !== 'object') return m;

  /* ── Arrays that MUST exist ── */
  var arrayFields = [
    'recentBalls', 'commentary', 'fow', 'oversTimeline',
    'currentOverBalls', 'partnerRuns', 'shotLog',
    'innings1PartnerRuns', 'innings1Fow', 'lastBowlerWkts',
    'cumulativeWorm'
  ];
  for (var i = 0; i < arrayFields.length; i++) {
    if (!Array.isArray(m[arrayFields[i]])) m[arrayFields[i]] = [];
  }

  /* cumulativeWorm must start with [0] */
  if (m.cumulativeWorm.length === 0) m.cumulativeWorm = [0];

  /* 8-sector arrays */
  var sectorFields = ['sectorRuns', 'innings1SectorRuns', 'innings2SectorRuns'];
  for (var j = 0; j < sectorFields.length; j++) {
    if (!Array.isArray(m[sectorFields[j]]) || m[sectorFields[j]].length !== 8) {
      m[sectorFields[j]] = [0, 0, 0, 0, 0, 0, 0, 0];
    }
  }

  /* ── Objects ── */
  var objFields = ['batters', 'bowlers', 'fielding', 'playerTeamMap'];
  for (var k = 0; k < objFields.length; k++) {
    if (!m[objFields[k]] || typeof m[objFields[k]] !== 'object') m[objFields[k]] = {};
  }

  /* ── Numbers ── */
  var numFields = {
    runs: 0, wickets: 0, legalBalls: 0, totalOvers: 20, originalOvers: 20,
    innings: 1, target: 0, _currentOverRuns: 0, _lastOverRuns: 0
  };
  for (var nf in numFields) {
    if (typeof m[nf] !== 'number' || isNaN(m[nf])) m[nf] = numFields[nf];
  }

  /* ── Strings ── */
  var strFields = ['teamBatting', 'teamBowling', 'teamBattingAbbr', 'teamBowlingAbbr', 'striker', 'nonStriker', 'currentBowler', 'previousBowler', 'venue'];
  for (var si = 0; si < strFields.length; si++) {
    if (typeof m[strFields[si]] !== 'string') m[strFields[si]] = '';
  }

  /* ── Booleans ── */
  if (typeof m.isActive !== 'boolean') m.isActive = false;
  if (typeof m.isFreeHit !== 'boolean') m.isFreeHit = false;

  /* ── currentPartnership ── */
  if (!m.currentPartnership || typeof m.currentPartnership !== 'object') {
    m.currentPartnership = { runs: 0, balls: 0, batters: [] };
  } else {
    if (typeof m.currentPartnership.runs !== 'number')  m.currentPartnership.runs = 0;
    if (typeof m.currentPartnership.balls !== 'number') m.currentPartnership.balls = 0;
    if (!Array.isArray(m.currentPartnership.batters))   m.currentPartnership.batters = [];
  }

  return m;
}
window.normalizeMatch = normalizeMatch;

/* ═══════════════════════════════════════════════════════════
   RETIRE HELPERS
   ═══════════════════════════════════════════════════════════ */
function markBatterRetired(role, reason) {
  if (!match.isActive) return null;
  const name = match[role];
  if (!name || !match.batters[name]) return null;

  const statusKey = reason === 'Retired Out' ? 'retired out' : 'retired hurt';
  match.batters[name].status = statusKey;

  if (reason === 'Retired Out') {
    match.wickets += 1;
    match.fow.push(`${match.runs}/${match.wickets} (${name} retired out)`);
  }
  return name;
}

function setReplacementBatter(role, newBatterName) {
  if (!match.isActive || !newBatterName) return false;
  const n = autoCapitalize(newBatterName.trim());
  if (!n) return false;
  if (n === match.striker || n === match.nonStriker) return false;

  if (!match.batters[n]) {
    match.batters[n] = { runs: 0, balls: 0, fours: 0, sixes: 0, dots: 0, fifties: 0, hundreds: 0, status: 'batting' };
    match.playerTeamMap[n] = match.teamBattingAbbr;
    autoAddPlayerToTeam(n, match.teamBatting);
  } else {
    match.batters[n].status = 'batting';
  }

  if (role === 'striker') match.striker = n;
  else match.nonStriker = n;

  match.currentPartnership = { runs: 0, balls: 0, batters: [match.striker, match.nonStriker] };
  return true;
}

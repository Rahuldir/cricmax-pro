/* ============================================================
   state.js — Application state, config, empty match
   ⚠️ NEVER deletes user data automatically.
   ============================================================ */

/* ─── Global state ──────────────────────────────────────── */
let savedTeams = [];
let currentTourn = null;
let currentTournId = null;
let tournamentsHistory = [];
let pastMatchesLedger = [];      /* ← NEVER auto-trimmed */
let selectedTeam1 = { name: "", squad: [] };
let selectedTeam2 = { name: "", squad: [] };
let historyStack = [];           /* ← undo stack; grows up to MAX_UNDO */
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

/* Undo cap — user can undo 100 balls. Adjust freely. */
const MAX_UNDO = 100;

/* ═══════════════════════════════════════════════════════════
   DEFAULT CONFIG
   ═══════════════════════════════════════════════════════════ */
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
   RETIRE HELPERS (used by scoring.js)
   These mark the retiring batter's status. No auto-deletion.
   ═══════════════════════════════════════════════════════════ */
function markBatterRetired(role, reason) {
  /* role: 'striker' | 'nonStriker'; reason: 'Retired Hurt' | 'Retired Out' */
  if (!match.isActive) return null;
  const name = match[role];
  if (!name || !match.batters[name]) return null;

  const statusKey = reason === 'Retired Out' ? 'retired out' : 'retired hurt';
  match.batters[name].status = statusKey;

  if (reason === 'Retired Out') {
    /* Retired Out = counts as a wicket (bowler gets no credit) */
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

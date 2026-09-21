/* ============================================================
   state.js — Application state, config, empty match
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

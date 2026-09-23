/* ═══════════════════════════════════════════════════════════════════════
   CricMax — Shot Inference Engine v1.0
   ─────────────────────────────────────────────────────────────────────
   Infers realistic shot metadata from just (runs + direction).
   
   Input:  { runs, zoneIndex, isSpin, isWkt, isCatch, wktMethod,
             matchId, ballNum }
   Output: { shot, length, trajectory, timing, footwork,
             swingSpeed, contactHeight, advance, zone, libShot }
   
   Deterministic: same input always yields same output (seeded RNG).
   No Firebase writes. No side effects. Pure function.
   
   Exposes: window.CricMaxInference
   ═══════════════════════════════════════════════════════════════════════ */
(function(){
'use strict';

/* ═══════════════════════════════════════════════════════════════
   CONFIG — tune weights here without touching logic
   ═══════════════════════════════════════════════════════════════ */
const CONFIG = {

  /* Spin bowler adjustments to length pool */
  spinShift: {
    bouncerToShort: true,
    goodBoost: 1.10,
    fullBoost: 1.05
  },

  /* Advance down pitch probabilities */
  advanceChanceLofted: 0.15,
  advanceChanceBase:   0.03,

  /* Rotation shots — front foot preference */
  frontFootPref: 0.80,

  /* Zone names (index 0-7 matching wagon wheel) */
  zones: [
    'Third Man',
    'Point',
    'Cover',
    'Mid-off',
    'Mid-on',
    'Mid-wicket',
    'Square Leg',
    'Fine Leg'
  ],

  /* ═══════════════════════════════════════════════════════════════
     RUNS + ZONE → CANDIDATE SHOTS (weighted)
     ═══════════════════════════════════════════════════════════════ */
  shotPool: {
    six: {
      'Third Man':  [['edge',0.6],['upper_cut',0.4]],
      'Point':      [['upper_cut',0.4],['slog_over_cover',0.3],['inside_out_lofted',0.3]],
      'Cover':      [['slog_over_cover',0.5],['inside_out_lofted',0.3],['straight_drive_lofted',0.2]],
      'Mid-off':    [['straight_drive_lofted',0.6],['slog_over_cover',0.4]],
      'Mid-on':     [['straight_drive_lofted',0.6],['slog_over_cover',0.4]],
      'Mid-wicket': [['slog_sweep',0.4],['pull_lofted',0.4],['flick',0.2]],
      'Square Leg': [['pull_lofted',0.5],['slog_sweep',0.3],['hook',0.2]],
      'Fine Leg':   [['slog_sweep',0.6],['flick',0.4]]
    },
    four: {
      'Third Man':  [['late_cut',0.5],['upper_cut',0.2],['edge',0.3]],
      'Point':      [['cut',0.6],['punch',0.4]],
      'Cover':      [['cover_drive',0.6],['drive_grounded',0.4]],
      'Mid-off':    [['straight_drive',0.5],['drive_grounded',0.5]],
      'Mid-on':     [['straight_drive',0.5],['pull',0.5]],
      'Mid-wicket': [['flick',0.5],['pull',0.5]],
      'Square Leg': [['pull',0.7],['sweep',0.3]],
      'Fine Leg':   [['glance',0.5],['sweep',0.3],['reverse_sweep_grounded',0.2]]
    },
    three: {
      'Third Man':  [['late_cut',0.6],['cut',0.4]],
      'Point':      [['cut',0.5],['punch',0.5]],
      'Cover':      [['drive_grounded',0.4],['cover_drive',0.3],['cut',0.3]],
      'Mid-off':    [['straight_drive',0.6],['drive_grounded',0.4]],
      'Mid-on':     [['straight_drive',0.6],['drive_grounded',0.4]],
      'Mid-wicket': [['flick',0.4],['pull',0.4],['hook',0.2]],
      'Square Leg': [['pull',0.5],['hook',0.3],['flick',0.2]],
      'Fine Leg':   [['hook',0.3],['flick',0.4],['pull',0.3]]
    },
    two: {
      'Third Man':  [['late_cut',0.5],['push',0.5]],
      'Point':      [['push',0.4],['punch',0.3],['cut',0.3]],
      'Cover':      [['push',0.4],['punch',0.3],['cut',0.3]],
      'Mid-off':    [['drive_grounded',0.5],['push',0.5]],
      'Mid-on':     [['drive_grounded',0.5],['push',0.5]],
      'Mid-wicket': [['glance',0.4],['flick',0.3],['nudge',0.3]],
      'Square Leg': [['glance',0.4],['flick',0.3],['nudge',0.3]],
      'Fine Leg':   [['glance',0.5],['nudge',0.5]]
    },
    one: {
      'Third Man':  [['late_cut',0.4],['push',0.6]],
      'Point':      [['push',0.5],['nudge',0.3],['punch',0.2]],
      'Cover':      [['push',0.5],['nudge',0.3],['punch',0.2]],
      'Mid-off':    [['drive_grounded',0.5],['push',0.5]],
      'Mid-on':     [['drive_grounded',0.5],['push',0.5]],
      'Mid-wicket': [['nudge',0.5],['glance',0.3],['flick',0.2]],
      'Square Leg': [['nudge',0.5],['glance',0.3],['flick',0.2]],
      'Fine Leg':   [['nudge',0.5],['glance',0.5]]
    },
    dot: {
      'Third Man':  [['block',0.35],['defend',0.30],['leave',0.15],['push',0.10],['nudge',0.05],['pull',0.05]],
      'Point':      [['block',0.35],['defend',0.30],['leave',0.10],['push',0.15],['cut',0.10]],
      'Cover':      [['block',0.30],['defend',0.30],['leave',0.05],['push',0.20],['drive_grounded',0.15]],
      'Mid-off':    [['block',0.35],['defend',0.35],['leave',0.05],['push',0.15],['drive_grounded',0.10]],
      'Mid-on':     [['block',0.35],['defend',0.35],['leave',0.05],['push',0.15],['drive_grounded',0.10]],
      'Mid-wicket': [['block',0.30],['defend',0.25],['push',0.15],['nudge',0.20],['pull',0.10]],
      'Square Leg': [['block',0.30],['defend',0.25],['push',0.15],['nudge',0.20],['pull',0.10]],
      'Fine Leg':   [['block',0.30],['defend',0.30],['push',0.20],['nudge',0.20]]
    },
    /* Wicket-specific pools — direction irrelevant for these */
    wicket_bowled:  [['block',0.5],['defend',0.5]],
    wicket_lbw:     [['block',0.5],['defend',0.5]],
    wicket_caught:  [['slog_over_cover',0.25],['pull_lofted',0.25],['straight_drive_lofted',0.20],['inside_out_lofted',0.15],['upper_cut',0.15]],
    wicket_runout:  [['push',0.5],['nudge',0.5]],
    wicket_stumped: [['leave',0.4],['advance',0.6]]
  },

  /* ═══════════════════════════════════════════════════════════════
     SHOT → COMPATIBLE LENGTHS (weighted)
     ═══════════════════════════════════════════════════════════════ */
  lengthPool: {
    'defend':                  [['good',0.50],['full',0.30],['short',0.20]],
    'block':                   [['good',0.50],['full',0.30],['short',0.20]],
    'leave':                   [['good',0.40],['short',0.30],['full',0.30]],
    'push':                    [['good',0.50],['full',0.30],['short',0.20]],
    'nudge':                   [['good',0.50],['full',0.30],['short',0.20]],
    'glance':                  [['full',0.50],['good',0.40],['short',0.10]],
    'flick':                   [['full',0.50],['good',0.40],['yorker',0.10]],
    'drive_grounded':          [['full',0.50],['good',0.30],['half_volley',0.20]],
    'cover_drive':             [['full',0.50],['good',0.40],['half_volley',0.10]],
    'straight_drive':          [['full',0.60],['good',0.30],['half_volley',0.10]],
    'cut':                     [['short',0.50],['back_of_length',0.30],['good',0.20]],
    'late_cut':                [['back_of_length',0.50],['short',0.30],['good',0.20]],
    'upper_cut':               [['short',0.60],['bouncer',0.40]],
    'pull':                    [['short',0.60],['back_of_length',0.40]],
    'hook':                    [['bouncer',0.60],['short',0.40]],
    'pull_lofted':             [['short',0.50],['bouncer',0.50]],
    'sweep':                   [['good',0.50],['full',0.40],['yorker',0.10]],
    'slog_sweep':              [['good',0.50],['full',0.40],['yorker',0.10]],
    'reverse_sweep_lofted':    [['good',0.50],['full',0.50]],
    'reverse_sweep_grounded':  [['good',0.60],['full',0.40]],
    'straight_drive_lofted':   [['full',0.50],['good',0.40],['half_volley',0.10]],
    'slog_over_cover':         [['full',0.40],['good',0.40],['half_volley',0.20]],
    'inside_out_lofted':       [['full',0.50],['good',0.50]],
    'punch':                   [['back_of_length',0.50],['good',0.30],['short',0.20]],
    'edge':                    [['good',0.50],['short',0.30],['full',0.20]],
    'advance':                 [['good',0.60],['full',0.40]]
  },

  /* ═══════════════════════════════════════════════════════════════
     SHOT → TRAJECTORY (deterministic)
     ═══════════════════════════════════════════════════════════════ */
  trajectoryOf: {
    'defend':'grounded_medium','block':'grounded_medium','leave':'miss',
    'push':'grounded_medium','nudge':'grounded_medium','glance':'grounded_fast',
    'flick':'grounded_fast','drive_grounded':'grounded_fast','cover_drive':'grounded_fast',
    'straight_drive':'grounded_fast','cut':'grounded_fast','late_cut':'grounded_fast',
    'upper_cut':'lofted_mid','pull':'grounded_fast','hook':'lofted_mid',
    'pull_lofted':'lofted_high','sweep':'sweep_low','slog_sweep':'lofted_mid',
    'reverse_sweep_lofted':'lofted_mid','reverse_sweep_grounded':'sweep_low',
    'straight_drive_lofted':'lofted_high','slog_over_cover':'lofted_high',
    'inside_out_lofted':'lofted_mid','punch':'grounded_fast','edge':'edge',
    'advance':'lofted_high'
  },

  /* ═══════════════════════════════════════════════════════════════
     RUNS → TIMING (weighted)
     ═══════════════════════════════════════════════════════════════ */
  timingPool: {
    6: [['middled',0.70],['well_timed',0.25],['mistimed',0.04],['edged',0.01]],
    4: [['middled',0.55],['well_timed',0.30],['mistimed',0.12],['edged',0.03]],
    3: [['middled',0.40],['well_timed',0.40],['mistimed',0.15],['edged',0.05]],
    2: [['middled',0.35],['well_timed',0.40],['mistimed',0.20],['edged',0.05]],
    1: [['middled',0.30],['well_timed',0.40],['mistimed',0.25],['edged',0.05]],
    0: [['middled',0.20],['well_timed',0.35],['mistimed',0.35],['edged',0.10]],
    wicket_bowled:  [['mistimed',0.20],['edged',0.80]],
    wicket_caught:  [['middled',0.05],['well_timed',0.15],['mistimed',0.55],['edged',0.25]],
    wicket_lbw:     [['mistimed',0.40],['edged',0.60]],
    wicket_runout:  [['well_timed',0.50],['mistimed',0.50]],
    wicket_stumped: [['mistimed',1.00]]
  },

  /* ═══════════════════════════════════════════════════════════════
     SHOT → FOOTWORK
     ═══════════════════════════════════════════════════════════════ */
  footworkOf: {
    'defend':'front','block':'front','leave':'none',
    'push':'front_random','nudge':'front_random','glance':'front_random','flick':'front_random',
    'drive_grounded':'front','cover_drive':'front','straight_drive':'front',
    'cut':'back','late_cut':'back','upper_cut':'back','punch':'back',
    'pull':'back','hook':'back','pull_lofted':'back',
    'sweep':'front_knee','slog_sweep':'front_knee',
    'reverse_sweep_lofted':'front_knee','reverse_sweep_grounded':'front_knee',
    'straight_drive_lofted':'front','slog_over_cover':'front','inside_out_lofted':'front',
    'edge':'back','advance':'down_track'
  },

  /* ═══════════════════════════════════════════════════════════════
     SHOT + LENGTH → CONTACT HEIGHT
     ═══════════════════════════════════════════════════════════════ */
  contactHeightOf: {
    base: {
      'defend':'mid','block':'mid','push':'mid','nudge':'mid',
      'glance':'low','flick':'mid',
      'drive_grounded':'mid','cover_drive':'mid','straight_drive':'mid',
      'cut':'high','late_cut':'high','upper_cut':'high','punch':'mid',
      'pull':'high','hook':'high','pull_lofted':'high',
      'sweep':'low','slog_sweep':'low',
      'reverse_sweep_lofted':'low','reverse_sweep_grounded':'low',
      'straight_drive_lofted':'mid','slog_over_cover':'mid','inside_out_lofted':'mid',
      'edge':'high','leave':'mid','advance':'mid'
    },
    yorkerShift: -1,
    bouncerShift: 1
  }
};

/* ═══════════════════════════════════════════════════════════════
   SEEDED RNG — deterministic per ball
   Same seed → same sequence of picks → same animation every reload.
   ═══════════════════════════════════════════════════════════════ */
function makeSeed(str){
  let h = 5381;
  str = String(str || 'x');
  for (let i = 0; i < str.length; i++) h = ((h * 33) ^ str.charCodeAt(i)) >>> 0;
  return h;
}

function makeRng(seed){
  let s = seed | 0;
  if (s === 0) s = 1;
  return function(){
    s = (s * 1664525 + 1013904223) & 0x7fffffff;
    return (s >>> 8) / 16777216;
  };
}

/* ═══════════════════════════════════════════════════════════════
   WEIGHTED RANDOM PICKER
   pool = [['name', weight], ['name', weight], ...]
   ═══════════════════════════════════════════════════════════════ */
function pickWeighted(pool, rng){
  if (!pool || !pool.length) return null;
  let total = 0;
  for (let i = 0; i < pool.length; i++) total += pool[i][1];
  if (total <= 0) return pool[0][0];
  let r = rng() * total;
  for (let i = 0; i < pool.length; i++){
    r -= pool[i][1];
    if (r <= 0) return pool[i][0];
  }
  return pool[pool.length - 1][0];
}

/* ═══════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════ */
function getZoneName(idx){
  idx = Math.max(0, Math.min(7, parseInt(idx, 10) || 0));
  return CONFIG.zones[idx];
}

function applySpinShift(pool){
  if (!pool) return pool;
  const merged = {};
  for (let i = 0; i < pool.length; i++){
    let len = pool[i][0];
    let w = pool[i][1];
    if (CONFIG.spinShift.bouncerToShort && len === 'bouncer'){
      len = 'short';
    }
    if (len === 'good') w *= CONFIG.spinShift.goodBoost;
    if (len === 'full') w *= CONFIG.spinShift.fullBoost;
    merged[len] = (merged[len] || 0) + w;
  }
  const out = [];
  for (const k in merged) out.push([k, merged[k]]);
  return out;
}

function shiftContactHeight(base, length){
  const order = ['very_low','low','mid','high','very_high'];
  let idx = order.indexOf(base);
  if (idx < 0) idx = 2;
  if (length === 'yorker')  idx = Math.max(0, idx + CONFIG.contactHeightOf.yorkerShift);
  if (length === 'bouncer') idx = Math.min(order.length - 1, idx + CONFIG.contactHeightOf.bouncerShift);
  return order[idx];
}

function computeSwingSpeed(timing, runs, shotName){
  if (shotName === 'block' || shotName === 'defend' || shotName === 'leave') return 'soft';
  if (timing === 'middled' && runs >= 6)    return 'slog';
  if (timing === 'middled' && runs === 4)   return 'hard';
  if (timing === 'middled')                 return 'medium';
  if (timing === 'well_timed' && runs >= 4) return 'hard';
  if (timing === 'well_timed')              return 'medium';
  if (timing === 'mistimed' || timing === 'edged') return 'soft';
  return 'soft';
}

/* ═══════════════════════════════════════════════════════════════
   MAIN INFER FUNCTION
   ═══════════════════════════════════════════════════════════════ */
function infer(opts){
  opts = opts || {};
  const runs    = opts.runs || 0;
  const zoneIdx = opts.zoneIndex || 0;
  const zone    = getZoneName(zoneIdx);
  const isSpin  = !!opts.isSpin;
  const isWkt   = !!opts.isWkt;
  const wktMeth = String(opts.wktMethod || '').toLowerCase();
  const isCatch = !!opts.isCatch;

  /* Deterministic seed per ball */
  const seedKey = (opts.matchId || '') + ':' + (opts.ballNum || 0) + ':' +
                  runs + ':' + zoneIdx + (isWkt ? 'W:' + wktMeth : '');
  const rng = makeRng(makeSeed(seedKey));

  /* ─── Step 1: Pick shot name ─── */
  let shotName;
  if (isWkt){
    if (isCatch)                             shotName = pickWeighted(CONFIG.shotPool.wicket_caught, rng);
    else if (wktMeth.indexOf('bowl') >= 0)   shotName = pickWeighted(CONFIG.shotPool.wicket_bowled, rng);
    else if (wktMeth.indexOf('lbw') >= 0)    shotName = pickWeighted(CONFIG.shotPool.wicket_lbw, rng);
    else if (wktMeth.indexOf('run') >= 0)    shotName = pickWeighted(CONFIG.shotPool.wicket_runout, rng);
    else if (wktMeth.indexOf('stump') >= 0)  shotName = pickWeighted(CONFIG.shotPool.wicket_stumped, rng);
    else                                      shotName = 'defend';
  } else {
    const key = runs >= 6 ? 'six'
              : runs === 4 ? 'four'
              : runs === 3 ? 'three'
              : runs === 2 ? 'two'
              : runs === 1 ? 'one'
              : 'dot';
    const pool = (CONFIG.shotPool[key] && CONFIG.shotPool[key][zone])
               || (CONFIG.shotPool.dot && CONFIG.shotPool.dot[zone])
               || [['defend',1]];
    shotName = pickWeighted(pool, rng) || 'defend';
  }

  /* ─── Step 2: Pick length compatible with shot ─── */
  let lengthPool = CONFIG.lengthPool[shotName] || CONFIG.lengthPool['defend'];
  if (isSpin) lengthPool = applySpinShift(lengthPool);
  const length = pickWeighted(lengthPool, rng) || 'good';

  /* ─── Step 3: Trajectory from shot ─── */
  let trajectory = CONFIG.trajectoryOf[shotName] || 'grounded_medium';
  if (shotName === 'advance') trajectory = 'lofted_high';

  /* ─── Step 4: Timing ─── */
  let timingKey;
  if (isWkt){
    timingKey = isCatch                              ? 'wicket_caught'
              : wktMeth.indexOf('bowl') >= 0         ? 'wicket_bowled'
              : wktMeth.indexOf('lbw') >= 0          ? 'wicket_lbw'
              : wktMeth.indexOf('run') >= 0          ? 'wicket_runout'
              : 'wicket_stumped';
  } else {
    timingKey = Math.min(6, runs);
  }
  const timing = pickWeighted(CONFIG.timingPool[timingKey], rng) || 'well_timed';

  /* ─── Step 5: Footwork ─── */
  let footwork = CONFIG.footworkOf[shotName] || 'front';
  if (footwork === 'front_random'){
    footwork = rng() < CONFIG.frontFootPref ? 'front' : 'back';
  }

  /* ─── Step 6: Swing speed ─── */
  const swingSpeed = computeSwingSpeed(timing, runs, shotName);

  /* ─── Step 7: Contact height ─── */
  let contactHeight = CONFIG.contactHeightOf.base[shotName] || 'mid';
  contactHeight = shiftContactHeight(contactHeight, length);

  /* ─── Step 8: Advance down pitch ─── */
  const lofted = (shotName.indexOf('lofted') >= 0 || trajectory === 'lofted_high');
  const advance = rng() < (lofted ? CONFIG.advanceChanceLofted : CONFIG.advanceChanceBase);
  if (advance) footwork = 'down_track';

  /* ─── Resolve library shot record ─── */
  let libShot = null;
  if (window.CricMaxShots && window.CricMaxShots.SHOTS && window.CricMaxShots.SHOTS[shotName]){
    libShot = window.CricMaxShots.SHOTS[shotName];
  }

  /* ─── Return full inferred record ─── */
  return {
    shot: shotName,
    length: length,
    trajectory: trajectory,
    timing: timing,
    footwork: footwork,
    swingSpeed: swingSpeed,
    contactHeight: contactHeight,
    advance: advance,
    zone: zone,
    zoneIndex: zoneIdx,
    libShot: libShot
  };
}

/* ═══════════════════════════════════════════════════════════════
   EXPORT
   ═══════════════════════════════════════════════════════════════ */
window.CricMaxInference = {
  infer: infer,
  CONFIG: CONFIG,
  version: '1.0'
};

console.log('[CricMax] 🎯 Shot Inference v1.0 — 25 shots, 7 lengths, deterministic');

})();

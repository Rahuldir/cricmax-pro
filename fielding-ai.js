/* ============================================================
   CricMax Pro — Fielding AI
   Fielder positions, chase/throw/catch/dive logic
   Exposes: window.CricMaxFielding
   ============================================================ */
(function(){
  'use strict';

  const FIELD_POSITIONS = {
    slip:            { x:  3.0, z:  3.5,  role: 'close_catch', depth: 'close' },
    gully:           { x:  6.0, z:  3.0,  role: 'close_catch', depth: 'close' },
    point:           { x: 18.0, z:  4.0,  role: 'ring',        depth: 'ring' },
    cover:           { x: 22.0, z: -2.0,  role: 'ring',        depth: 'ring' },
    mid_off:         { x:  8.0, z:-10.0,  role: 'ring',        depth: 'ring' },
    mid_on:          { x: -8.0, z:-10.0,  role: 'ring',        depth: 'ring' },
    mid_wicket:      { x:-20.0, z:  0.0,  role: 'ring',        depth: 'ring' },
    square_leg:      { x:-18.0, z:  6.0,  role: 'ring',        depth: 'ring' },
    third_man:       { x: 26.0, z:  8.0,  role: 'deep',        depth: 'deep' },
    deep_point:      { x: 30.0, z:  2.0,  role: 'deep',        depth: 'deep' },
    deep_cover:      { x: 40.0, z: -5.0,  role: 'deep',        depth: 'deep' },
    long_off:        { x: 15.0, z:-30.0,  role: 'deep',        depth: 'deep' },
    long_on:         { x:-15.0, z:-30.0,  role: 'deep',        depth: 'deep' },
    deep_mid_wicket: { x:-32.0, z:  0.0,  role: 'deep',        depth: 'deep' },
    deep_square:     { x:-30.0, z:  8.0,  role: 'deep',        depth: 'deep' },
    fine_leg:        { x: -3.0, z:-40.0,  role: 'deep',        depth: 'deep' },
    keeper:          { x:  0.0, z:-14.5,  role: 'keeper',      depth: 'close' },
    bowler:          { x:  0.0, z:-22.0,  role: 'bowler',      depth: 'ring' }
  };

  const FIELD_PRESETS = {
    attacking: ['slip', 'gully', 'point', 'cover', 'mid_off', 'mid_on', 'mid_wicket', 'square_leg', 'keeper', 'bowler'],
    balanced:  ['slip', 'point', 'cover', 'mid_off', 'mid_on', 'mid_wicket', 'square_leg', 'long_off', 'fine_leg', 'keeper', 'bowler'],
    defensive: ['point', 'cover', 'mid_off', 'mid_on', 'mid_wicket', 'third_man', 'deep_point', 'deep_cover', 'long_off', 'long_on', 'deep_mid_wicket', 'deep_square', 'fine_leg', 'keeper', 'bowler'],
    powerplay: ['slip', 'gully', 'point', 'cover', 'mid_off', 'mid_on', 'mid_wicket', 'square_leg', 'keeper', 'bowler'],
    death_overs: ['point', 'cover', 'mid_off', 'mid_on', 'third_man', 'deep_point', 'deep_cover', 'long_off', 'long_on', 'deep_mid_wicket', 'fine_leg', 'keeper', 'bowler']
  };

  const CATCH_DIFFICULTY = {
    easy:    { minTime: 1.5, maxSpeed: 25, successRate: 0.95 },
    medium:  { minTime: 1.0, maxSpeed: 35, successRate: 0.75 },
    hard:    { minTime: 0.6, maxSpeed: 45, successRate: 0.45 },
    extreme: { minTime: 0.3, maxSpeed: 55, successRate: 0.15 }
  };

  const FIELDER_STATS = {
    close_catch: { reactionTime: 0.15, maxSpeed: 8.0, catchRadius: 1.2, diveRadius: 2.2, throwPower: 0.7 },
    ring:        { reactionTime: 0.25, maxSpeed: 9.0, catchRadius: 0.9, diveRadius: 1.8, throwPower: 0.85 },
    deep:        { reactionTime: 0.35, maxSpeed: 9.5, catchRadius: 0.7, diveRadius: 1.5, throwPower: 1.0 },
    keeper:      { reactionTime: 0.10, maxSpeed: 6.0, catchRadius: 1.4, diveRadius: 2.5, throwPower: 0.9 },
    bowler:      { reactionTime: 0.20, maxSpeed: 7.5, catchRadius: 1.0, diveRadius: 2.0, throwPower: 0.8 }
  };

  function calculateFielderIntercept(fielder, ballTrajectory){
    const fx = fielder.home.x;
    const fz = fielder.home.z;
    const bx = ballTrajectory.landX || 0;
    const bz = ballTrajectory.landZ || 0;
    const dx = bx - fx;
    const dz = bz - fz;
    const dist = Math.sqrt(dx * dx + dz * dz);
    const stats = FIELDER_STATS[fielder.role] || FIELDER_STATS.ring;
    const timeToLand = ballTrajectory.flightTime || 3;
    const reachDist = stats.maxSpeed * timeToLand + stats.catchRadius;
    const canReach = dist < reachDist;
    const mustDive = canReach && dist > stats.catchRadius * 1.5;
    return {
      canReach: canReach,
      mustDive: mustDive,
      distance: dist,
      timeToLand: timeToLand,
      difficulty: dist / reachDist
    };
  }

  function resolveCatch(fielder, trajectory, isDifficult){
    if (!fielder || !trajectory) return { caught: false, reason: 'no_data' };
    const intercept = calculateFielderIntercept(fielder, trajectory);
    if (!intercept.canReach){
      return { caught: false, reason: 'out_of_reach', distance: intercept.distance };
    }
    let successRate = 0.95;
    if (isDifficult) successRate = 0.65;
    if (intercept.mustDive) successRate *= 0.75;
    if (trajectory.speed > 35) successRate *= 0.85;
    const roll = Math.random();
    if (roll < successRate){
      return {
        caught: true,
        fielder: fielder.name || 'Fielder',
        position: fielder.home.clone(),
        dive: intercept.mustDive,
        difficulty: intercept.difficulty
      };
    } else {
      return {
        caught: false,
        reason: 'dropped',
        fielder: fielder.name || 'Fielder',
        position: fielder.home.clone(),
        dive: intercept.mustDive
      };
    }
  }

  function pickFieldPreset(matchState){
    if (!matchState) return 'balanced';
    const overNum = Math.floor((matchState.legalBalls || 0) / 6);
    const totalOvers = matchState.totalOvers || 20;
    const runsNeeded = (matchState.target || 0) - (matchState.runs || 0);
    const ballsLeft = (totalOvers * 6) - (matchState.legalBalls || 0);
    if (overNum < 6) return 'powerplay';
    if (overNum >= totalOvers - 4) return 'death_overs';
    if (ballsLeft < 30 && runsNeeded > 0 && runsNeeded < 60) return 'death_overs';
    const crr = matchState.legalBalls > 0
      ? (matchState.runs || 0) / ((matchState.legalBalls || 1) / 6)
      : 0;
    if (crr > 10) return 'defensive';
    if (crr < 6) return 'attacking';
    return 'balanced';
  }

  window.CricMaxFielding = {
    FIELD_POSITIONS: FIELD_POSITIONS,
    FIELD_PRESETS: FIELD_PRESETS,
    FIELDER_STATS: FIELDER_STATS,
    CATCH_DIFFICULTY: CATCH_DIFFICULTY,

    getPosition: function(name){ return FIELD_POSITIONS[name] || null; },
    getPreset: function(presetName){ return FIELD_PRESETS[presetName] || FIELD_PRESETS.balanced; },
    pickPreset: pickFieldPreset,
    intercept: calculateFielderIntercept,
    resolveCatch: resolveCatch
  };
})();

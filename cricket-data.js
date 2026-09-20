/* ============================================================
   CricMax Pro — Cricket Simulation Data
   Physics constants, bowling actions, delivery types, pitch profiles
   Exposes: window.CricMaxData
   ============================================================ */
(function(){
  'use strict';

  const PHYSICS = {
    gravity: 9.81,
    airDensity: 1.225,
    ballMass: 0.156,
    ballRadius: 0.036,
    ballDragCoefficient: 0.45,
    magnusCoefficient: 0.00022,
    seamEffect: 0.30,
    bounceRestitution: 0.55,
    surfaceFriction: 0.35,
    spinDecay: 0.92,
    sceneScale: 1.0
  };

  const PITCH_PROFILES = {
    green: { name: 'Green Top', paceMultiplier: 1.05, bounceMultiplier: 1.15, seamMovement: 1.4, spinGrip: 0.8, color: 0x2d6f38, description: 'Extra bounce and seam movement' },
    dusty: { name: 'Dusty Turner', paceMultiplier: 0.9, bounceMultiplier: 0.9, seamMovement: 0.6, spinGrip: 1.5, color: 0x9b744a, description: 'Slow, low bounce, heavy spin' },
    hard:  { name: 'Hard & Fast', paceMultiplier: 1.1, bounceMultiplier: 1.1, seamMovement: 0.9, spinGrip: 0.9, color: 0xa8815c, description: 'True bounce, good for stroke play' },
    dry:   { name: 'Dry Surface', paceMultiplier: 1.0, bounceMultiplier: 1.0, seamMovement: 0.7, spinGrip: 1.2, color: 0x8b6a4a, description: 'Balanced, slight turn' },
    wet:   { name: 'Damp Pitch', paceMultiplier: 0.85, bounceMultiplier: 0.75, seamMovement: 1.6, spinGrip: 0.7, color: 0x5a4a35, description: 'Slow, low, unpredictable' }
  };

  const BOWLING_ACTIONS = {
    fast_pace: {
      name: 'Fast Pace', runupDuration: 5200, runupDistance: 22, runupSteps: 18,
      gatherDuration: 400, deliveryDuration: 350, followThroughDuration: 800,
      releaseHeight: 2.15, releaseAngle: -8, speedRange: [135, 152],
      bouncePoint: [5.5, 7.5], swingType: 'outswing', armSlot: 'high',
      description: 'Express pace, high arm'
    },
    medium_pace: {
      name: 'Medium Pace', runupDuration: 4200, runupDistance: 18, runupSteps: 14,
      gatherDuration: 500, deliveryDuration: 400, followThroughDuration: 700,
      releaseHeight: 2.05, releaseAngle: -6, speedRange: [118, 135],
      bouncePoint: [6.0, 8.0], swingType: 'inswing', armSlot: 'medium',
      description: 'Controlled pace with movement'
    },
    off_spin: {
      name: 'Off Spin', runupDuration: 3200, runupDistance: 14, runupSteps: 10,
      gatherDuration: 600, deliveryDuration: 550, followThroughDuration: 600,
      releaseHeight: 2.20, releaseAngle: -4, speedRange: [82, 95],
      bouncePoint: [4.5, 6.0], spinAxis: 'off_to_leg', spinRPM: 2200,
      armSlot: 'high', description: 'Right-arm off break'
    },
    leg_spin: {
      name: 'Leg Spin', runupDuration: 3400, runupDistance: 15, runupSteps: 11,
      gatherDuration: 600, deliveryDuration: 550, followThroughDuration: 600,
      releaseHeight: 2.15, releaseAngle: -4, speedRange: [78, 92],
      bouncePoint: [4.5, 6.0], spinAxis: 'leg_to_off', spinRPM: 2400,
      armSlot: 'side', description: 'Right-arm leg break'
    },
    left_arm_orthodox: {
      name: 'Left-arm Orthodox', runupDuration: 3200, runupDistance: 14, runupSteps: 10,
      gatherDuration: 600, deliveryDuration: 550, followThroughDuration: 600,
      releaseHeight: 2.18, releaseAngle: -4, speedRange: [80, 94],
      bouncePoint: [4.5, 6.0], spinAxis: 'off_to_leg', spinRPM: 2100,
      armSlot: 'high', description: 'Left-arm orthodox spin'
    }
  };

  const DELIVERY_TYPES = {
    yorker:           { name: 'Yorker', length: 'full', bouncePoint: 8.5, paceBonus: 1.05, swingMod: 0.6, difficulty: 0.85, wagonAngleBias: 0.3 },
    full_toss:        { name: 'Full Toss', length: 'full', bouncePoint: 9.5, paceBonus: 1.02, swingMod: 0.4, difficulty: 0.95, wagonAngleBias: 0.8 },
    length_ball:      { name: 'Good Length', length: 'length', bouncePoint: 6.5, paceBonus: 1.0, swingMod: 1.2, difficulty: 0.55, wagonAngleBias: 0.5 },
    back_of_length:   { name: 'Back of Length', length: 'back', bouncePoint: 4.5, paceBonus: 1.03, swingMod: 1.0, difficulty: 0.45, wagonAngleBias: 0.4 },
    short_ball:       { name: 'Short Ball', length: 'short', bouncePoint: 3.0, paceBonus: 1.04, swingMod: 0.5, difficulty: 0.6, wagonAngleBias: -0.3 },
    bouncer:          { name: 'Bouncer', length: 'bouncer', bouncePoint: 2.0, paceBonus: 1.06, swingMod: 0.3, difficulty: 0.7, heightMax: 2.4, wagonAngleBias: -0.5 },
    slower_ball:      { name: 'Slower Ball', length: 'length', bouncePoint: 6.0, paceBonus: 0.75, swingMod: 0.8, difficulty: 0.65, wagonAngleBias: 0.5 },
    cutter:           { name: 'Cutter', length: 'length', bouncePoint: 5.5, paceBonus: 0.92, swingMod: 0.6, lateralDeviation: 0.5, difficulty: 0.7, wagonAngleBias: 0.4 },
    knuckleball:      { name: 'Knuckle Ball', length: 'length', bouncePoint: 6.0, paceBonus: 0.85, swingMod: 0.3, lateralDeviation: -0.4, difficulty: 0.75, wagonAngleBias: 0.4 },
    off_break:        { name: 'Off Break', length: 'length', bouncePoint: 5.5, paceBonus: 1.0, spinTurn: 1.0, difficulty: 0.6, wagonAngleBias: 0.5 },
    arm_ball:         { name: 'Arm Ball', length: 'length', bouncePoint: 6.0, paceBonus: 1.05, spinTurn: 0.15, difficulty: 0.55, wagonAngleBias: 0.4 },
    doosra:           { name: 'Doosra', length: 'length', bouncePoint: 5.5, paceBonus: 0.95, spinTurn: -0.8, difficulty: 0.75, wagonAngleBias: 0.3 },
    googly:           { name: 'Googly', length: 'length', bouncePoint: 5.5, paceBonus: 0.95, spinTurn: -1.1, difficulty: 0.8, wagonAngleBias: 0.2 },
    topspinner:       { name: 'Top Spinner', length: 'length', bouncePoint: 5.0, paceBonus: 1.0, spinTurn: 0.2, extraBounce: 0.3, difficulty: 0.7, wagonAngleBias: 0.5 },
    flipper:          { name: 'Flipper', length: 'length', bouncePoint: 6.5, paceBonus: 1.1, spinTurn: 0.4, lowBounce: 0.3, difficulty: 0.75, wagonAngleBias: 0.4 }
  };

  const SHOT_WEIGHTS = {
    0: { defend: 45, block: 20, leave: 10, push: 10, drive_grounded: 8, sweep: 3, edge: 4 },
    1: { push: 25, nudge: 20, defend: 15, drive_grounded: 15, glance: 10, drop: 10, sweep: 5 },
    2: { drive_grounded: 25, glance: 20, nudge: 15, pull: 15, sweep: 10, cut: 10, flick: 5 },
    3: { drive_grounded: 30, pull: 20, cut: 20, glance: 15, flick: 10, sweep: 5 },
    4: { drive_grounded: 20, cut: 15, pull: 15, cover_drive: 15, straight_drive: 12, sweep: 10, glance: 8, flick: 5 },
    6: { pull_lofted: 25, hook: 15, straight_drive_lofted: 20, slog_sweep: 15, slog_over_cover: 15, reverse_sweep_lofted: 5, inside_out_lofted: 5 }
  };

  const BOWLER_DELIVERY_MATRIX = {
    fast_pace: ['yorker', 'length_ball', 'back_of_length', 'short_ball', 'bouncer', 'slower_ball', 'cutter'],
    medium_pace: ['length_ball', 'back_of_length', 'short_ball', 'slower_ball', 'cutter', 'knuckleball', 'full_toss'],
    off_spin: ['off_break', 'arm_ball', 'doosra', 'topspinner', 'flipper'],
    leg_spin: ['googly', 'topspinner', 'flipper', 'off_break'],
    left_arm_orthodox: ['off_break', 'arm_ball', 'topspinner']
  };

  const WAGON_SECTORS = [
    { name: 'Third Man',  minAngle: -0.30, maxAngle: 0.30, midAngle: 0,    rFactor: 0.85 },
    { name: 'Point',      minAngle: 0.30,  maxAngle: 0.90, midAngle: 0.60, rFactor: 0.9 },
    { name: 'Cover',      minAngle: 0.90,  maxAngle: 1.50, midAngle: 1.20, rFactor: 0.95 },
    { name: 'Mid-off',    minAngle: 1.50,  maxAngle: 1.90, midAngle: 1.70, rFactor: 1.0 },
    { name: 'Mid-on',     minAngle: 1.90,  maxAngle: 2.30, midAngle: 2.10, rFactor: 1.0 },
    { name: 'Mid-wicket', minAngle: 2.30,  maxAngle: 2.90, midAngle: 2.60, rFactor: 0.95 },
    { name: 'Square Leg', minAngle: 2.90,  maxAngle: 3.50, midAngle: 3.20, rFactor: 0.9 },
    { name: 'Fine Leg',   minAngle: 3.50,  maxAngle: 4.10, midAngle: 3.80, rFactor: 0.85 }
  ];

  const TRAJECTORY_TEMPLATES = {
    grounded_fast:   { launchAngle: 3,  peakHeight: 0.5,  distance: 40, spin: -0.5,  time: 2.5, distanceVariance: 0.15 },
    grounded_medium: { launchAngle: 8,  peakHeight: 1.2,  distance: 30, spin: -0.3,  time: 3.0, distanceVariance: 0.2 },
    lofted_low:      { launchAngle: 20, peakHeight: 4,    distance: 50, spin: -0.2,  time: 3.2, distanceVariance: 0.25 },
    lofted_mid:      { launchAngle: 30, peakHeight: 8,    distance: 65, spin: -0.15, time: 3.8, distanceVariance: 0.2 },
    lofted_high:     { launchAngle: 40, peakHeight: 14,   distance: 78, spin: -0.1,  time: 4.5, distanceVariance: 0.15 },
    sweep_low:       { launchAngle: 12, peakHeight: 1.5,  distance: 45, spin: -0.6,  time: 2.8, distanceVariance: 0.3 },
    edge:            { launchAngle: 25, peakHeight: 3,    distance: 20, spin: -0.3,  time: 2.0, distanceVariance: 0.5 }
  };

  const SHOT_COMMENTARY = {
    defend: ['Solid defence', 'Blocked back', 'Straight bat', 'Textbook defence'],
    block: ['Dropped into the pitch', 'Dead bat', 'Killed the pace'],
    leave: ['Left alone', 'Shouldered arms', 'Watched it through'],
    push: ['Pushed into the gap', 'Worked into the offside', 'Nudged through'],
    nudge: ['Nudged off the pads', 'Tucked around the corner', 'Soft hands'],
    glance: ['Glanced fine', 'Flicked off the hip', 'Deflected to fine leg'],
    drive_grounded: ['Driven along the ground', 'Beautifully timed', 'Cracked through the covers'],
    cover_drive: ['Classic cover drive!', 'Leaning into the drive', 'Elegant through the offside'],
    straight_drive: ['Straight down the ground', 'Textbook straight drive', 'Punched back past the bowler'],
    cut: ['Cut hard behind point', 'Square cut!', 'Slashed away'],
    pull: ['Pulled away powerfully', 'Swivelled into the pull', 'Rocked back and pulled'],
    pull_lofted: ['Pulled high into the stands!', 'Massive pull shot!'],
    hook: ['Hooked into the deep!', 'Perfectly executed hook'],
    sweep: ['Swept hard into the leg side', 'Paddled away fine'],
    slog_sweep: ['SLOG SWEEP! Into the crowd', 'Went for the big one!'],
    straight_drive_lofted: ['LOFTED STRAIGHT DRIVE!', 'Chip over the bowler'],
    inside_out_lofted: ['Inside-out through covers!'],
    reverse_sweep_lofted: ['REVERSE SWEEP! Bold shot'],
    slog_over_cover: ['SLASHED OVER COVER!'],
    edge: ['Edged... and gone!', 'Thick edge!', 'Came off the outside half'],
    flick: ['Flicked away with finesse', 'Wristy flick', 'Whipped through midwicket']
  };

  const UMPIRE_SIGNALS = {
    out:      { name: 'Out',      armRotation: 'raise_right_up',      duration: 1200 },
    not_out:  { name: 'Not Out',  armRotation: 'shake_head',          duration: 1500 },
    wide:     { name: 'Wide',     armRotation: 'arms_horizontal',     duration: 800 },
    no_ball:  { name: 'No Ball',  armRotation: 'raise_right_shoulder',duration: 1000 },
    four:     { name: 'Four',     armRotation: 'sweep_arms_across',   duration: 900 },
    six:      { name: 'Six',      armRotation: 'both_arms_up',        duration: 1000 },
    bye:      { name: 'Bye',      armRotation: 'palm_open',           duration: 700 },
    leg_bye:  { name: 'Leg Bye',  armRotation: 'touch_leg',           duration: 700 }
  };

  const CROWD_REACTIONS = {
    six:        { intensity: 1.0,  cheerDuration: 3200, waveChance: 0.6, noiseLevel: 0.95 },
    four:       { intensity: 0.8,  cheerDuration: 2400, waveChance: 0.4, noiseLevel: 0.85 },
    wicket:     { intensity: 1.0,  cheerDuration: 3500, waveChance: 0.7, noiseLevel: 1.0 },
    near_miss:  { intensity: 0.6,  cheerDuration: 1500, waveChance: 0.2, noiseLevel: 0.7 },
    dot_ball:   { intensity: 0.15, cheerDuration: 400,  waveChance: 0.05,noiseLevel: 0.3 },
    run:        { intensity: 0.3,  cheerDuration: 800,  waveChance: 0.1, noiseLevel: 0.5 },
    milestone:  { intensity: 1.0,  cheerDuration: 5000, waveChance: 0.9, noiseLevel: 1.0 },
    over_end:   { intensity: 0.2,  cheerDuration: 600,  waveChance: 0.05,noiseLevel: 0.4 }
  };

  window.CricMaxData = {
    PHYSICS,
    PITCH_PROFILES,
    BOWLING_ACTIONS,
    DELIVERY_TYPES,
    SHOT_WEIGHTS,
    BOWLER_DELIVERY_MATRIX,
    WAGON_SECTORS,
    TRAJECTORY_TEMPLATES,
    SHOT_COMMENTARY,
    UMPIRE_SIGNALS,
    CROWD_REACTIONS,

    weightedPick: function(weights){
      const keys = Object.keys(weights);
      const total = keys.reduce((s, k) => s + weights[k], 0);
      let r = Math.random() * total;
      for (let i = 0; i < keys.length; i++){
        r -= weights[keys[i]];
        if (r <= 0) return keys[i];
      }
      return keys[keys.length - 1];
    },

    pickDelivery: function(bowlerType){
      const options = BOWLER_DELIVERY_MATRIX[bowlerType];
      if (!options) return 'length_ball';
      return options[Math.floor(Math.random() * options.length)];
    },

    pickShot: function(runs, bowlerType, deliveryType, pitchType){
      const weights = SHOT_WEIGHTS[runs] || SHOT_WEIGHTS[0];
      const shotType = this.weightedPick(weights);

      let trajKey = 'grounded_medium';
      if (shotType.indexOf('lofted') >= 0 || shotType === 'hook' || shotType === 'slog_sweep'){
        trajKey = runs === 6 ? 'lofted_high' : 'lofted_mid';
      } else if (shotType === 'edge'){
        trajKey = 'edge';
      } else if (runs >= 4){
        trajKey = 'grounded_fast';
      } else if (shotType === 'sweep' || shotType === 'reverse_sweep_lofted'){
        trajKey = 'sweep_low';
      } else if (runs <= 1){
        trajKey = 'grounded_medium';
      }

      const traj = TRAJECTORY_TEMPLATES[trajKey] || TRAJECTORY_TEMPLATES.grounded_medium;

      let sectorIdx = Math.floor(Math.random() * WAGON_SECTORS.length);

      if (shotType === 'pull' || shotType === 'pull_lofted' || shotType === 'hook'){
        sectorIdx = 5 + Math.floor(Math.random() * 2);
      }
      if (shotType === 'cut'){
        sectorIdx = 1 + Math.floor(Math.random() * 2);
      }
      if (shotType === 'cover_drive'){
        sectorIdx = 2;
      }
      if (shotType === 'straight_drive' || shotType === 'straight_drive_lofted'){
        sectorIdx = 3 + Math.floor(Math.random() * 2);
      }
      if (shotType === 'glance'){
        sectorIdx = 7;
      }
      if (shotType === 'sweep' || shotType === 'slog_sweep'){
        sectorIdx = 6;
      }

      const sector = WAGON_SECTORS[sectorIdx];
      const angleJitter = (Math.random() - 0.5) * (sector.maxAngle - sector.minAngle) * 0.6;
      const angle = sector.midAngle + angleJitter;

      const pitch = PITCH_PROFILES[pitchType] || PITCH_PROFILES.hard;
      const distBase = traj.distance * sector.rFactor;
      const distVar = (1 - traj.distanceVariance / 2) + Math.random() * traj.distanceVariance;
      const distance = distBase * distVar;

      const phrases = SHOT_COMMENTARY[shotType] || ['shot played'];
      const commentary = phrases[Math.floor(Math.random() * phrases.length)];

      return {
        shotType: shotType,
        trajectoryType: trajKey,
        sector: sector.name,
        sectorIdx: sectorIdx,
        angle: angle,
        distance: distance,
        peakHeight: traj.peakHeight,
        launchAngle: traj.launchAngle,
        flightTime: traj.time,
        spin: traj.spin,
        commentary: commentary
      };
    }
  };
})();

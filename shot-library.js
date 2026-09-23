/* ============================================================
   CricMax Pro — Shot Animation Library
   Every shot has: timing, body pose keyframes, trajectory, sound
   Exposes: window.CricMaxShots
   ============================================================ */
(function(){
  'use strict';

  const SHOTS = {

    /* ---------------- DEFENSIVE ---------------- */
    defend: {
      label: 'Defend', category: 'defensive',
      prepTime: 200, contactTime: 500, followTime: 400,
      trajectory: 'grounded_medium',
      pose: {
        batStart: { rotX: -Math.PI / 3, rotZ: 0 },
        batContact: { rotX: -Math.PI / 6, rotZ: 0 },
        batEnd: { rotX: -Math.PI / 8, rotZ: 0 },
        torsoRotY: 0, legStride: 0.15, headRotY: 0
      },
      sound: 'bat_tap', weight: 'medium'
    },
    block: {
      label: 'Block', category: 'defensive',
      prepTime: 150, contactTime: 450, followTime: 300,
      trajectory: 'grounded_medium',
      pose: {
        batStart: { rotX: -Math.PI / 4, rotZ: 0 },
        batContact: { rotX: -Math.PI / 8, rotZ: 0 },
        batEnd: { rotX: -Math.PI / 8, rotZ: 0 },
        torsoRotY: 0, legStride: 0.25, headRotY: 0
      },
      sound: 'bat_tap', weight: 'soft'
    },
    leave: {
      label: 'Leave', category: 'defensive',
      prepTime: 100, contactTime: 400, followTime: 200,
      trajectory: 'edge',
      pose: {
        batStart: { rotX: -Math.PI / 3, rotZ: 0 },
        batContact: { rotX: -Math.PI / 3, rotZ: 0 },
        batEnd: { rotX: -Math.PI / 3, rotZ: 0 },
        torsoRotY: 0, legStride: 0.05, headRotY: 0
      },
      sound: 'whoosh', weight: 'soft', noContact: true
    },

    /* ---------------- PLACED SHOTS ---------------- */
    push: {
      label: 'Push', category: 'rotation',
      prepTime: 200, contactTime: 480, followTime: 350,
      trajectory: 'grounded_medium',
      pose: {
        batStart: { rotX: -Math.PI / 3.5, rotZ: 0.1 },
        batContact: { rotX: -Math.PI / 5, rotZ: 0 },
        batEnd: { rotX: 0, rotZ: -0.2 },
        torsoRotY: 0.15, legStride: 0.2, headRotY: 0.1
      },
      sound: 'bat_tap', weight: 'medium'
    },
    nudge: {
      label: 'Nudge', category: 'rotation',
      prepTime: 180, contactTime: 460, followTime: 300,
      trajectory: 'grounded_medium',
      pose: {
        batStart: { rotX: -Math.PI / 4, rotZ: 0.15 },
        batContact: { rotX: -Math.PI / 6, rotZ: -0.1 },
        batEnd: { rotX: -Math.PI / 8, rotZ: -0.3 },
        torsoRotY: 0.25, legStride: 0.1, headRotY: 0.15
      },
      sound: 'bat_tap', weight: 'soft'
    },
    glance: {
      label: 'Glance', category: 'rotation',
      prepTime: 200, contactTime: 480, followTime: 400,
      trajectory: 'grounded_fast',
      pose: {
        batStart: { rotX: -Math.PI / 4, rotZ: 0.3 },
        batContact: { rotX: -Math.PI / 6, rotZ: 0 },
        batEnd: { rotX: 0, rotZ: -0.6 },
        torsoRotY: 0.5, legStride: 0.15, headRotY: 0.3
      },
      sound: 'bat_crack_soft', weight: 'medium'
    },
    flick: {
      label: 'Flick', category: 'rotation',
      prepTime: 220, contactTime: 500, followTime: 400,
      trajectory: 'grounded_fast',
      pose: {
        batStart: { rotX: -Math.PI / 4, rotZ: 0.4 },
        batContact: { rotX: -Math.PI / 5, rotZ: 0.1 },
        batEnd: { rotX: 0, rotZ: -0.7 },
        torsoRotY: 0.6, legStride: 0.2, headRotY: 0.4
      },
      sound: 'bat_crack_soft', weight: 'medium'
    },

    /* ---------------- DRIVES ---------------- */
    drive_grounded: {
      label: 'Drive', category: 'drive',
      prepTime: 250, contactTime: 520, followTime: 500,
      trajectory: 'grounded_fast',
      pose: {
        batStart: { rotX: -Math.PI / 3, rotZ: 0.2 },
        batContact: { rotX: -Math.PI / 4, rotZ: 0 },
        batEnd: { rotX: -Math.PI / 8, rotZ: -0.3 },
        torsoRotY: 0.35, legStride: 0.5, headRotY: 0.2
      },
      sound: 'bat_crack_med', weight: 'hard'
    },
    cover_drive: {
      label: 'Cover Drive', category: 'drive',
      prepTime: 240, contactTime: 510, followTime: 550,
      trajectory: 'grounded_fast',
      pose: {
        batStart: { rotX: -Math.PI / 3, rotZ: 0.3 },
        batContact: { rotX: -Math.PI / 5, rotZ: -0.15 },
        batEnd: { rotX: -Math.PI / 10, rotZ: -0.6 },
        torsoRotY: 0.55, legStride: 0.6, headRotY: 0.4
      },
      sound: 'bat_crack_med', weight: 'hard'
    },
    straight_drive: {
      label: 'Straight Drive', category: 'drive',
      prepTime: 260, contactTime: 530, followTime: 500,
      trajectory: 'grounded_fast',
      pose: {
        batStart: { rotX: -Math.PI / 2.5, rotZ: 0 },
        batContact: { rotX: -Math.PI / 3, rotZ: 0 },
        batEnd: { rotX: -Math.PI / 8, rotZ: 0 },
        torsoRotY: 0.05, legStride: 0.55, headRotY: 0
      },
      sound: 'bat_crack_hard', weight: 'hard'
    },

    /* ---------------- CUTS & PULLS ---------------- */
    cut: {
      label: 'Square Cut', category: 'cut',
      prepTime: 200, contactTime: 480, followTime: 500,
      trajectory: 'grounded_fast',
      pose: {
        batStart: { rotX: -Math.PI / 3, rotZ: -0.4 },
        batContact: { rotX: -Math.PI / 5, rotZ: -0.2 },
        batEnd: { rotX: -Math.PI / 8, rotZ: 0.3 },
        torsoRotY: -0.5, legStride: 0.15, headRotY: -0.3
      },
      sound: 'bat_crack_hard', weight: 'hard'
    },
    pull: {
      label: 'Pull Shot', category: 'pull',
      prepTime: 220, contactTime: 500, followTime: 500,
      trajectory: 'grounded_fast',
      pose: {
        batStart: { rotX: -Math.PI / 3, rotZ: -0.6 },
        batContact: { rotX: -Math.PI / 6, rotZ: -0.3 },
        batEnd: { rotX: 0, rotZ: 0.5 },
        torsoRotY: -0.7, legStride: -0.2, headRotY: -0.4
      },
      sound: 'bat_crack_hard', weight: 'hard'
    },

    /* ---------------- SWEEPS ---------------- */
    sweep: {
      label: 'Sweep', category: 'sweep',
      prepTime: 280, contactTime: 550, followTime: 500,
      trajectory: 'sweep_low',
      pose: {
        batStart: { rotX: -Math.PI / 4, rotZ: 0 },
        batContact: { rotX: Math.PI / 4, rotZ: 0 },
        batEnd: { rotX: Math.PI / 2.5, rotZ: 0 },
        torsoRotY: 1.2, legStride: -0.4, headRotY: 0.8
      },
      sound: 'bat_crack_med', weight: 'hard'
    },
    slog_sweep: {
      label: 'Slog Sweep', category: 'sweep',
      prepTime: 300, contactTime: 580, followTime: 600,
      trajectory: 'lofted_mid',
      pose: {
        batStart: { rotX: -Math.PI / 3, rotZ: 0 },
        batContact: { rotX: Math.PI / 3, rotZ: 0 },
        batEnd: { rotX: Math.PI / 2, rotZ: 0 },
        torsoRotY: 1.4, legStride: -0.5, headRotY: 0.9
      },
      sound: 'bat_crack_hard', weight: 'hard'
    },
    reverse_sweep_lofted: {
      label: 'Reverse Sweep', category: 'sweep',
      prepTime: 320, contactTime: 600, followTime: 550,
      trajectory: 'lofted_mid',
      pose: {
        batStart: { rotX: -Math.PI / 4, rotZ: 0.3 },
        batContact: { rotX: Math.PI / 5, rotZ: -0.4 },
        batEnd: { rotX: Math.PI / 3, rotZ: -0.6 },
        torsoRotY: -1.3, legStride: -0.3, headRotY: -0.7
      },
      sound: 'bat_crack_med', weight: 'hard'
    },

    /* ---------------- LOFTED / BIG HITS ---------------- */
    pull_lofted: {
      label: 'Lofted Pull', category: 'lofted',
      prepTime: 240, contactTime: 520, followTime: 700,
      trajectory: 'lofted_high',
      pose: {
        batStart: { rotX: -Math.PI / 3, rotZ: -0.5 },
        batContact: { rotX: -Math.PI / 8, rotZ: 0 },
        batEnd: { rotX: Math.PI / 3, rotZ: 0.6 },
        torsoRotY: -0.8, legStride: -0.3, headRotY: -0.5
      },
      sound: 'bat_crack_hard', weight: 'hard'
    },
    hook: {
      label: 'Hook', category: 'lofted',
      prepTime: 220, contactTime: 500, followTime: 700,
      trajectory: 'lofted_high',
      pose: {
        batStart: { rotX: -Math.PI / 3, rotZ: -0.7 },
        batContact: { rotX: -Math.PI / 6, rotZ: -0.2 },
        batEnd: { rotX: Math.PI / 4, rotZ: 0.5 },
        torsoRotY: -0.9, legStride: -0.4, headRotY: -0.6
      },
      sound: 'bat_crack_hard', weight: 'hard'
    },
    straight_drive_lofted: {
      label: 'Lofted Straight Drive', category: 'lofted',
      prepTime: 280, contactTime: 540, followTime: 700,
      trajectory: 'lofted_high',
      pose: {
        batStart: { rotX: -Math.PI / 2.5, rotZ: 0 },
        batContact: { rotX: -Math.PI / 4, rotZ: 0 },
        batEnd: { rotX: Math.PI / 4, rotZ: 0 },
        torsoRotY: 0.05, legStride: 0.6, headRotY: 0
      },
      sound: 'bat_crack_hard', weight: 'hard'
    },
    slog_over_cover: {
      label: 'Slog over Cover', category: 'lofted',
      prepTime: 300, contactTime: 560, followTime: 700,
      trajectory: 'lofted_high',
      pose: {
        batStart: { rotX: -Math.PI / 3, rotZ: 0.5 },
        batContact: { rotX: -Math.PI / 6, rotZ: -0.3 },
        batEnd: { rotX: Math.PI / 3, rotZ: -0.7 },
        torsoRotY: 0.7, legStride: 0.4, headRotY: 0.5
      },
      sound: 'bat_crack_hard', weight: 'hard'
    },
    inside_out_lofted: {
      label: 'Inside-out Lofted', category: 'lofted',
      prepTime: 280, contactTime: 540, followTime: 650,
      trajectory: 'lofted_mid',
      pose: {
        batStart: { rotX: -Math.PI / 3, rotZ: 0.4 },
        batContact: { rotX: -Math.PI / 5, rotZ: -0.2 },
        batEnd: { rotX: Math.PI / 4, rotZ: -0.5 },
        torsoRotY: 0.4, legStride: 0.3, headRotY: 0.35
      },
      sound: 'bat_crack_med', weight: 'medium'
    },

      /* ---------------- ADDITIONAL PLACED SHOTS ---------------- */
    punch: {
      label: 'Punch', category: 'rotation',
      prepTime: 220, contactTime: 500, followTime: 400,
      trajectory: 'grounded_fast',
      pose: {
        batStart:   { rotX: -Math.PI / 3.5, rotZ: 0.1 },
        batContact: { rotX: -Math.PI / 5,   rotZ: -0.1 },
        batEnd:     { rotX: -Math.PI / 8,   rotZ: -0.35 },
        torsoRotY: 0.35, legStride: 0.25, headRotY: 0.2
      },
      sound: 'bat_crack_med', weight: 'medium'
    },
    late_cut: {
      label: 'Late Cut', category: 'cut',
      prepTime: 200, contactTime: 460, followTime: 450,
      trajectory: 'grounded_fast',
      pose: {
        batStart:   { rotX: -Math.PI / 4, rotZ: -0.3 },
        batContact: { rotX: -Math.PI / 3, rotZ: 0.5 },
        batEnd:     { rotX: -Math.PI / 3, rotZ: 0.7 },
        torsoRotY: -0.4, legStride: 0.1, headRotY: -0.5
      },
      sound: 'bat_crack_soft', weight: 'medium'
    },
    upper_cut: {
      label: 'Upper Cut', category: 'cut',
      prepTime: 240, contactTime: 480, followTime: 550,
      trajectory: 'lofted_mid',
      pose: {
        batStart:   { rotX: -Math.PI / 3, rotZ: -0.5 },
        batContact: { rotX: -Math.PI / 4, rotZ: 0 },
        batEnd:     { rotX: 0, rotZ: 0.4 },
        torsoRotY: -0.3, legStride: -0.15, headRotY: -0.4
      },
      sound: 'bat_crack_med', weight: 'hard'
    },
    reverse_sweep_grounded: {
      label: 'Reverse Sweep', category: 'sweep',
      prepTime: 300, contactTime: 560, followTime: 480,
      trajectory: 'sweep_low',
      pose: {
        batStart:   { rotX: -Math.PI / 4, rotZ: 0.3 },
        batContact: { rotX: Math.PI / 6,  rotZ: -0.2 },
        batEnd:     { rotX: Math.PI / 4,  rotZ: -0.4 },
        torsoRotY: -1.2, legStride: -0.35, headRotY: -0.6
      },
      sound: 'bat_crack_soft', weight: 'medium'
    },

    /* ---------------- EDGE ---------------- */
    edge: {
      label: 'Edge', category: 'accidental',
      prepTime: 180, contactTime: 450, followTime: 300,
      trajectory: 'edge',
      pose: {
        batStart: { rotX: -Math.PI / 3, rotZ: 0 },
        batContact: { rotX: -Math.PI / 3, rotZ: 0.15 },
        batEnd: { rotX: -Math.PI / 3, rotZ: 0.2 },
        torsoRotY: 0.1, legStride: 0.1, headRotY: 0
      },
      sound: 'bat_edge', weight: 'soft'
    }
  };

  const BOWLER_PHASES = {
    fast_pace: {
      runup: { bodyLean: 0.15, armCycle: 'counter_rotate', stepDuration: 289 },
      gather: { duration: 400, armPullBack: -Math.PI, bodyRotY: 0.4 },
      delivery: { duration: 350, armSwing: -Math.PI * 2, torsoSnap: 0.6, frontLegPlant: true },
      followThrough: { duration: 800, bodyFollow: 0.9, armDecay: 0.3 }
    },
    off_spin: {
      runup: { bodyLean: 0.08, armCycle: 'steady', stepDuration: 320 },
      gather: { duration: 600, armPullBack: -Math.PI * 0.6, bodyRotY: -0.3 },
      delivery: { duration: 550, armSwing: -Math.PI * 1.5, torsoSnap: 0.35, wristFlick: true },
      followThrough: { duration: 600, bodyFollow: 0.4, armDecay: 0.6 }
    }
  };

  window.CricMaxShots = {
    SHOTS: SHOTS,
    BOWLER_PHASES: BOWLER_PHASES,

    get: function(name){ return SHOTS[name] || SHOTS.defend; },

    byCategory: function(cat){
      return Object.keys(SHOTS).filter(function(k){ return SHOTS[k].category === cat; });
    },

    pickFromCategory: function(cat){
      const list = this.byCategory(cat);
      if (!list.length) return 'defend';
      return list[Math.floor(Math.random() * list.length)];
    },

    getTimeline: function(shotName){
      const shot = this.get(shotName);
      return {
        total: shot.prepTime + shot.contactTime + shot.followTime,
        prepEnd: shot.prepTime,
        contactAt: shot.prepTime + shot.contactTime,
        followEnd: shot.prepTime + shot.contactTime + shot.followTime,
        shot: shot
      };
    }
  };
})();

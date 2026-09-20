/* ============================================================
   CricMax Pro — Crowd Animation System
   Replaces the static crowd from stadium.js with real animated
   fans: bob, cheer, wave, and Mexican wave.
   Exposes: window.CricMaxCrowd
   ============================================================ */
(function(){
  'use strict';

  const COLORS = [0xe5534b, 0xe8b04a, 0x48a8c4, 0x9b6dd0, 0x4eb87a, 0xd9629e, 0xdcc24a, 0x5f7fd9];

  function build(scene, opts){
    opts = opts || {};
    const handle = {};
    const CROWD_RINGS = opts.rings || [
      { r: 65, count: 220, yBase: 1.0 },
      { r: 68, count: 240, yBase: 1.8 },
      { r: 71, count: 260, yBase: 2.6 },
      { r: 73, count: 300, yBase: 3.6 },
      { r: 76, count: 340, yBase: 5.5 },
      { r: 79, count: 380, yBase: 6.3 },
      { r: 82, count: 420, yBase: 8.2 },
      { r: 85, count: 460, yBase: 9.0 }
    ];

    const fanGeo = new THREE.BoxGeometry(0.22, 0.4, 0.22);
    const fans = [];

    /* Small flag geometry for waving fans */
    const flagGeo = new THREE.PlaneGeometry(0.22, 0.16);

    CROWD_RINGS.forEach((ring, ringIdx) => {
      const count = ring.count;
      const inst = new THREE.InstancedMesh(
        fanGeo,
        new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.75 }),
        count
      );
      inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      const color = new THREE.Color();
      const phases = [];
      const speeds = [];
      for (let s = 0; s < count; s++){
        const a = (s / count) * Math.PI * 2;
        const m = new THREE.Matrix4();
        m.setPosition(Math.cos(a) * ring.r, ring.yBase, Math.sin(a) * ring.r);
        inst.setMatrixAt(s, m);
        color.setHex(COLORS[Math.floor(Math.random() * COLORS.length)]);
        inst.setColorAt(s, color);
        phases.push(Math.random() * Math.PI * 2);
        speeds.push(1.2 + Math.random() * 1.4);
      }
      scene.add(inst);
      fans.push({
        mesh: inst,
        phases: phases,
        speeds: speeds,
        ring: ring,
        count: count,
        baseY: ring.yBase
      });
    });

    /* Flags on top ring */
    const flagInst = new THREE.InstancedMesh(
      flagGeo,
      new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true, opacity: 0.85 }),
      CROWD_RINGS[CROWD_RINGS.length - 1].count
    );
    flagInst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const topRing = CROWD_RINGS[CROWD_RINGS.length - 1];
    const topColor = new THREE.Color();
    for (let s = 0; s < topRing.count; s++){
      const a = (s / topRing.count) * Math.PI * 2;
      const m = new THREE.Matrix4();
      m.setPosition(Math.cos(a) * topRing.r, topRing.yBase + 1.2, Math.sin(a) * topRing.r);
      flagInst.setMatrixAt(s, m);
      topColor.setHex(COLORS[Math.floor(Math.random() * COLORS.length)]);
      flagInst.setColorAt(s, topColor);
    }
    scene.add(flagInst);

    handle.fans = fans;
    handle.flags = flagInst;
    handle.crowdExcitement = 0;
    handle.mexicanWavePhase = -1;
    handle.mexicanWaveStart = 0;

    /* ---------- Excitement trigger ---------- */
    handle.cheer = function(intensity){
      handle.crowdExcitement = Math.min(1.0, handle.crowdExcitement + (intensity || 0.7));
      // 40% chance of mexican wave for big moments
      if ((intensity || 0.7) > 0.85 && Math.random() < 0.4){
        handle.startMexicanWave();
      }
    };

    handle.startMexicanWave = function(){
      handle.mexicanWaveStart = performance.now();
      handle.mexicanWavePhase = 0;
    };

    /* ---------- Update every frame ---------- */
    const _tempM = new THREE.Matrix4();
    const _tempP = new THREE.Vector3();
    const _tempQ = new THREE.Quaternion();
    const _tempS = new THREE.Vector3();

    handle.update = function(dt, elapsed){
      handle.crowdExcitement *= Math.pow(0.985, dt * 60);
      const waveActive = handle.mexicanWavePhase >= 0;

      fans.forEach(f => {
        const excitement = handle.crowdExcitement;
        for (let s = 0; s < f.count; s++){
          f.mesh.getMatrixAt(s, _tempM);
          _tempM.decompose(_tempP, _tempQ, _tempS);

          const baseY = f.baseY;
          const phase = f.phases[s];
          const speed = f.speeds[s];

          // Natural bob — always present
          const naturalBob = Math.sin(elapsed * speed + phase) * 0.05;
          // Cheer jump — only when excited
          const cheerJump = excitement * (Math.abs(Math.sin(elapsed * 6 + phase * 2)) * 0.3);

          // Mexican wave — a travelling vertical bulge
          let waveY = 0;
          if (waveActive){
            const waveElapsed = (performance.now() - handle.mexicanWaveStart) / 1000;
            const angle = Math.atan2(_tempP.z, _tempP.x);
            const normalised = ((angle + Math.PI) / (Math.PI * 2)); // 0..1
            const wavePos = (waveElapsed * 0.5) % 1.5;
            const dist = Math.abs(normalised - wavePos);
            if (dist < 0.08){
              waveY = (0.08 - dist) / 0.08 * 0.9;
            }
          }

          _tempP.y = baseY + naturalBob + cheerJump + waveY;
          _tempM.compose(_tempP, _tempQ, _tempS);
          f.mesh.setMatrixAt(s, _tempM);
        }
        f.mesh.instanceMatrix.needsUpdate = true;
      });

      // Flags wave
      const flagCount = topRing.count;
      for (let s = 0; s < flagCount; s++){
        flagInst.getMatrixAt(s, _tempM);
        _tempM.decompose(_tempP, _tempQ, _tempS);
        const a = (s / flagCount) * Math.PI * 2;
        const swing = Math.sin(elapsed * 3 + s * 0.4) * 0.3 * (0.3 + handle.crowdExcitement);
        _tempP.y = topRing.yBase + 1.2 + Math.abs(swing) * 0.15;
        const rotate = new THREE.Quaternion().setFromEuler(new THREE.Euler(swing, a, 0));
        _tempM.compose(_tempP, rotate, _tempS);
        flagInst.setMatrixAt(s, _tempM);
      }
      flagInst.instanceMatrix.needsUpdate = true;

      if (waveActive){
        const elapsedWave = (performance.now() - handle.mexicanWaveStart) / 1000;
        if (elapsedWave > 3.2){
          handle.mexicanWavePhase = -1;
        }
      }
    };

    console.log('🎉 Animated crowd built:', fans.length, 'rings');
    return handle;
  }

  window.CricMaxCrowd = { build };
})();

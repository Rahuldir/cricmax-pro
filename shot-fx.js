/* ═══════════════════════════════════════════════════════════════════════
   CricMax — Shot FX (Optimized + Realistic)
   • Ball trail with taper (bright at ball, dark behind)
   • Sparks with white-hot → orange → red color variety
   • Surface-aware dust (tan on pitch, green on outfield)
   • Impact flash sprite on contact
   • Bounce marks left behind on pitch
   • Tier-based LOD, active-count tracking, dirty-flag uploads
   ═══════════════════════════════════════════════════════════════════════ */
(function(){
'use strict';

window.CricMaxParticles = {
  build: function(scene, renderer, camera) {

    /* ─────────────── TIER DETECTION + CONFIG ─────────────── */
    const tier = (window.__cmDevice && window.__cmDevice.tier) || 2;
    const isLowTier = tier === 0;

    const TRAIL_LEN     = isLowTier ? 12 : tier === 1 ? 20 : 30;
    const SPARK_COUNT   = isLowTier ? 20 : tier === 1 ? 40 : 60;
    const DUST_COUNT    = isLowTier ? 15 : tier === 1 ? 25 : 40;
    const BOUNCE_MARKS  = isLowTier ? 3  : 6;

    const useAdditive = tier >= 1;      // MOB-1: additive is fill-rate heavy
    const useAtten    = tier >= 1;      // OPT-8: disable size attenuation on low-tier

    /* OPT-6: match trail sample rate to render rate */
    const TRAIL_SAMPLE_INTERVAL = 1 / (tier === 0 ? 30 : tier === 1 ? 45 : 60);

    /* ═══════════════════════════════════════════════════════════════
       BALL TRAIL — tapered (bright at ball, dark behind)
       Uses shift-based buffer so vertex color taper stays correct.
       ═══════════════════════════════════════════════════════════════ */
    const trailGeo = new THREE.BufferGeometry();
    const trailPos = new Float32Array(TRAIL_LEN * 3);
    const trailCol = new Float32Array(TRAIL_LEN * 3);
    for (let i = 0; i < TRAIL_LEN; i++){
      trailPos[i*3 + 1] = -100;
      const f = 1 - i / TRAIL_LEN;
      /* Index 0 = freshest (bright white-yellow) → last index = oldest (dark orange) */
      trailCol[i*3]     = 0.30 + 0.70 * f;
      trailCol[i*3 + 1] = 0.10 + 0.70 * f;
      trailCol[i*3 + 2] = 0.02 + 0.28 * f;
    }
    trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));
    trailGeo.setAttribute('color',    new THREE.BufferAttribute(trailCol, 3));

    const trailMat = new THREE.PointsMaterial({
      size: 0.32,
      transparent: true,
      opacity: 0.9,
      vertexColors: true,
      blending: useAdditive ? THREE.AdditiveBlending : THREE.NormalBlending,
      depthWrite: false,
      sizeAttenuation: useAtten
    });
    const ballTrail = new THREE.Points(trailGeo, trailMat);
    ballTrail.frustumCulled = false;
    scene.add(ballTrail);

    const trail = { active: false, cooldown: 0, dirty: false };

    /* ═══════════════════════════════════════════════════════════════
       SPARKS — vertex colors for white-hot → orange → red variety
       ═══════════════════════════════════════════════════════════════ */
    const sparkGeo = new THREE.BufferGeometry();
    const sparkPos  = new Float32Array(SPARK_COUNT * 3);
    const sparkCol  = new Float32Array(SPARK_COUNT * 3);
    const sparkVel  = new Float32Array(SPARK_COUNT * 3);
    const sparkLife = new Float32Array(SPARK_COUNT);
    for (let i = 0; i < SPARK_COUNT; i++) sparkPos[i*3 + 1] = -100;
    sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
    sparkGeo.setAttribute('color',    new THREE.BufferAttribute(sparkCol, 3));

    const sparkMat = new THREE.PointsMaterial({
      size: 0.35,
      transparent: true,
      opacity: 1.0,
      vertexColors: true,
      blending: useAdditive ? THREE.AdditiveBlending : THREE.NormalBlending,
      depthWrite: false,
      sizeAttenuation: useAtten
    });
    const sparks = new THREE.Points(sparkGeo, sparkMat);
    sparks.frustumCulled = false;
    scene.add(sparks);

    let sparkActiveCount = 0;
    let sparkDirty = false;

    /* ═══════════════════════════════════════════════════════════════
       DUST — surface-aware (tan on pitch, green on outfield)
       ═══════════════════════════════════════════════════════════════ */
    const dustGeo = new THREE.BufferGeometry();
    const dustPos  = new Float32Array(DUST_COUNT * 3);
    const dustVel  = new Float32Array(DUST_COUNT * 3);
    const dustLife = new Float32Array(DUST_COUNT);
    for (let i = 0; i < DUST_COUNT; i++) dustPos[i*3 + 1] = -100;
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));

    const dustMat = new THREE.PointsMaterial({
      color: 0xc9b088,
      size: 0.24,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
      sizeAttenuation: useAtten
    });
    const dust = new THREE.Points(dustGeo, dustMat);
    dust.frustumCulled = false;
    scene.add(dust);

    let dustActiveCount = 0;
    let dustDirty = false;

    /* ═══════════════════════════════════════════════════════════════
       IMPACT FLASH — single sprite, additive blend, fades in 180ms
       ═══════════════════════════════════════════════════════════════ */
    const flashTex = (function(){
      const c = document.createElement('canvas');
      c.width = c.height = 64;
      const x = c.getContext('2d');
      const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0.00, 'rgba(255,255,255,1)');
      g.addColorStop(0.20, 'rgba(255,240,200,0.9)');
      g.addColorStop(0.60, 'rgba(255,180,80,0.4)');
      g.addColorStop(1.00, 'rgba(255,120,20,0)');
      x.fillStyle = g;
      x.fillRect(0, 0, 64, 64);
      return new THREE.CanvasTexture(c);
    })();

    const flashMat = new THREE.SpriteMaterial({
      map: flashTex,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false
    });
    const flash = new THREE.Sprite(flashMat);
    flash.scale.set(1.4, 1.4, 1);
    flash.visible = false;
    scene.add(flash);
    let flashLife = 0;
    const FLASH_DURATION = 0.18;

    /* ═══════════════════════════════════════════════════════════════
       BOUNCE MARKS — pooled decals left on pitch after each delivery
       ═══════════════════════════════════════════════════════════════ */
    const markGeo = new THREE.CircleGeometry(0.09, 10);
    const bounceMarks = [];
    for (let i = 0; i < BOUNCE_MARKS; i++){
      const mat = new THREE.MeshBasicMaterial({
        color: 0x8a7050,
        transparent: true,
        opacity: 0.0,
        depthWrite: false
      });
      const m = new THREE.Mesh(markGeo, mat);
      m.rotation.x = -Math.PI / 2;
      m.position.y = 0.02;
      m.visible = false;
      m.userData.life = 0;
      scene.add(m);
      bounceMarks.push(m);
    }
    let bounceMarkIdx = 0;

    /* ═══════════════════════════════════════════════════════════════
       PUBLIC TRIGGERS
       ═══════════════════════════════════════════════════════════════ */
    window.fxTrailStart = function(){
      trail.active = true;
      trail.cooldown = 0;
    };
    window.fxTrailStop = function(){
      trail.active = false;
      for (let i = 0; i < TRAIL_LEN; i++) trailPos[i*3 + 1] = -100;
      trailGeo.attributes.position.needsUpdate = true;
    };

    window.fxSparkBurst = function(x, y, z, colorHex){
      /* colorHex kept for API compatibility but ignored —
         vertex colors drive the visual now */
      for (let i = 0; i < SPARK_COUNT; i++){
        sparkPos[i*3]     = x + (Math.random() - 0.5) * 0.08;
        sparkPos[i*3 + 1] = y + Math.random() * 0.05;
        sparkPos[i*3 + 2] = z + (Math.random() - 0.5) * 0.08;
        const theta = Math.random() * Math.PI * 2;
        const phi   = Math.random() * Math.PI * 0.6;
        const sp    = 2 + Math.random() * 5;
        sparkVel[i*3]     = Math.sin(phi) * Math.cos(theta) * sp;
        sparkVel[i*3 + 1] = Math.abs(Math.cos(phi)) * sp * 1.3;
        sparkVel[i*3 + 2] = Math.sin(phi) * Math.sin(theta) * sp;
        sparkLife[i] = 0.6 + Math.random() * 0.5;

        /* REAL-4: white-hot → orange → red variety */
        const heat = Math.random();
        sparkCol[i*3]     = 1.0;
        sparkCol[i*3 + 1] = 0.50 + heat * 0.45;   // 0.50 → 0.95
        sparkCol[i*3 + 2] = heat * heat * 0.35;   // 0 → 0.35 (red-ish at cold end)
      }
      sparkActiveCount = SPARK_COUNT;
      sparkDirty = true;

      /* REAL-3: impact flash */
      flash.position.set(x, y, z);
      flash.visible = true;
      flashMat.opacity = 1.0;
      flash.scale.set(1.4, 1.4, 1);
      flashLife = FLASH_DURATION;
    };

    window.fxDustPuff = function(x, y, z, surface){
      /* REAL-5: surface-aware color */
      const onPitch = (surface === 'pitch') ||
                      (surface === undefined && Math.abs(z) < 12);
      dustMat.color.setHex(onPitch ? 0xc9b088 : 0x3a5a2a);

      const isSpin = surface === 'spin';   // REAL-8: bigger/slower puff for spin
      const speedMul = isSpin ? 0.7 : 1.0;
      const sizeBoost = isSpin ? 1.4 : 1.0;

      for (let i = 0; i < DUST_COUNT; i++){
        dustPos[i*3]     = x + (Math.random() - 0.5) * 0.3 * sizeBoost;
        dustPos[i*3 + 1] = y + Math.random() * 0.05;
        dustPos[i*3 + 2] = z + (Math.random() - 0.5) * 0.3 * sizeBoost;
        const theta = Math.random() * Math.PI * 2;
        const sp    = (0.6 + Math.random() * 1.4) * speedMul;
        dustVel[i*3]     = Math.cos(theta) * sp;
        dustVel[i*3 + 1] = (1.6 + Math.random() * 1.5) * speedMul;
        dustVel[i*3 + 2] = Math.sin(theta) * sp;
        dustLife[i] = (0.7 + Math.random() * 0.4) * (isSpin ? 1.3 : 1.0);
      }
      dustActiveCount = DUST_COUNT;
      dustDirty = true;
      dustMat.opacity = 0.85;
    };

    window.fxBounceMark = function(x, z){
      const m = bounceMarks[bounceMarkIdx];
      bounceMarkIdx = (bounceMarkIdx + 1) % BOUNCE_MARKS;
      m.position.set(x, 0.02, z);
      m.material.opacity = 0.55;
      m.visible = true;
      m.userData.life = 3.0;
    };

    /* ═══════════════════════════════════════════════════════════════
       PER-FRAME UPDATE — with early exits + dirty-flag uploads
       ═══════════════════════════════════════════════════════════════ */
    window.updateParticles = function(dt){
      /* Cap dt to prevent physics explosion on frame spikes */
      if (dt > 0.05) dt = 0.05;

      /* ─── Trail sampling ─── */
      if (trail.active && window.__cricmaxBallPos){
        const bp = window.__cricmaxBallPos;
        trail.cooldown -= dt;
        if (trail.cooldown <= 0){
          trail.cooldown = TRAIL_SAMPLE_INTERVAL;
          /* Shift down, new point at index 0 */
          for (let i = TRAIL_LEN - 1; i > 0; i--){
            trailPos[i*3]     = trailPos[(i-1)*3];
            trailPos[i*3 + 1] = trailPos[(i-1)*3 + 1];
            trailPos[i*3 + 2] = trailPos[(i-1)*3 + 2];
          }
          trailPos[0] = bp.x;
          trailPos[1] = bp.y;
          trailPos[2] = bp.z;
          trail.dirty = true;
        }
      }
      if (trail.dirty){
        trailGeo.attributes.position.needsUpdate = true;
        trail.dirty = false;
      }

      /* ─── Sparks physics — early exit when idle ─── */
      if (sparkActiveCount > 0){
        let aliveNow = 0;
        for (let i = 0; i < SPARK_COUNT; i++){
          if (sparkLife[i] > 0){
            aliveNow++;
            sparkLife[i] -= dt;
            sparkVel[i*3 + 1] -= 9.8 * dt;
            sparkPos[i*3]     += sparkVel[i*3]     * dt;
            sparkPos[i*3 + 1] += sparkVel[i*3 + 1] * dt;
            sparkPos[i*3 + 2] += sparkVel[i*3 + 2] * dt;
            if (sparkPos[i*3 + 1] < 0.05){
              sparkPos[i*3 + 1] = 0.05;
              sparkVel[i*3 + 1] *= -0.3;
              sparkVel[i*3]     *= 0.7;
              sparkVel[i*3 + 2] *= 0.7;
            }
            if (sparkLife[i] <= 0) sparkPos[i*3 + 1] = -100;
          }
        }
        sparkActiveCount = aliveNow;
        sparkDirty = true;
      }
      if (sparkDirty){
        sparkGeo.attributes.position.needsUpdate = true;
        sparkGeo.attributes.color.needsUpdate    = true;
        sparkDirty = false;
      }

      /* ─── Dust physics — early exit when idle ─── */
      if (dustActiveCount > 0){
        let aliveNow = 0;
        for (let i = 0; i < DUST_COUNT; i++){
          if (dustLife[i] > 0){
            aliveNow++;
            dustLife[i] -= dt * 0.85;
            dustVel[i*3 + 1] -= 2.5 * dt;
            dustVel[i*3]     *= 0.96;
            dustVel[i*3 + 2] *= 0.96;
            dustPos[i*3]     += dustVel[i*3]     * dt;
            dustPos[i*3 + 1] += dustVel[i*3 + 1] * dt;
            dustPos[i*3 + 2] += dustVel[i*3 + 2] * dt;
            if (dustLife[i] <= 0) dustPos[i*3 + 1] = -100;
          }
        }
        dustActiveCount = aliveNow;
        dustDirty = true;
        if (aliveNow === 0) dustMat.opacity = 0;
      }
      if (dustDirty){
        dustGeo.attributes.position.needsUpdate = true;
        dustDirty = false;
      }

      /* ─── Impact flash fade ─── */
      if (flashLife > 0){
        flashLife -= dt;
        if (flashLife <= 0){
          flash.visible = false;
          flashMat.opacity = 0;
        } else {
          const t = flashLife / FLASH_DURATION;
          flashMat.opacity = t * t;                    // quadratic fade-out
          flash.scale.setScalar(1.4 + (1 - t) * 1.2);  // expand as it fades
        }
      }

      /* ─── Bounce marks fade (2s later, fade over 3s) ─── */
      for (let i = 0; i < bounceMarks.length; i++){
        const m = bounceMarks[i];
        if (m.visible && m.userData.life > 0){
          m.userData.life -= dt;
          m.material.opacity = Math.min(0.55, m.userData.life * 0.18);
          if (m.userData.life <= 0){
            m.visible = false;
            m.material.opacity = 0;
          }
        }
      }
    };

    console.log('[CricMax] ✅ Shot FX active — tier ' + tier +
                ' (trail:' + TRAIL_LEN +
                ' sparks:' + SPARK_COUNT +
                ' dust:' + DUST_COUNT +
                ' marks:' + BOUNCE_MARKS +
                ' additive:' + useAdditive + ')');
  }
};

})();

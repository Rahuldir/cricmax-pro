/* ═══════════════════════════════════════════════════════════════════════
   CricMax — Shot FX
   Ball trail ribbon, impact sparks, pitch bounce dust.
   ═══════════════════════════════════════════════════════════════════════ */
(function(){
'use strict';

window.CricMaxParticles = {
  build: function(scene, renderer, camera) {

    /* ─────────────── BALL TRAIL ─────────────── */
    const TRAIL_LEN = 30;
    const trailGeo = new THREE.BufferGeometry();
    const trailPos = new Float32Array(TRAIL_LEN * 3);
    for (let i = 0; i < TRAIL_LEN; i++) trailPos[i*3 + 1] = -100;
    trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));

    const trailColors = new Float32Array(TRAIL_LEN * 3);
    for (let i = 0; i < TRAIL_LEN; i++){
      const f = 1 - i / TRAIL_LEN;
      trailColors[i*3]     = 1.00 * f + 0.30 * (1 - f);
      trailColors[i*3 + 1] = 0.85 * f;
      trailColors[i*3 + 2] = 0.35 * f;
    }
    trailGeo.setAttribute('color', new THREE.BufferAttribute(trailColors, 3));

    const trailMat = new THREE.PointsMaterial({
      size: 0.32, transparent: true, opacity: 0.9,
      vertexColors: true, blending: THREE.AdditiveBlending,
      depthWrite: false, sizeAttenuation: true
    });
    const ballTrail = new THREE.Points(trailGeo, trailMat);
    ballTrail.frustumCulled = false;
    scene.add(ballTrail);

    const trail = { active: false, cooldown: 0 };

    /* ─────────────── SPARKS ─────────────── */
    const SPARK_COUNT = 60;
    const sparkGeo = new THREE.BufferGeometry();
    const sparkPos  = new Float32Array(SPARK_COUNT * 3);
    const sparkVel  = new Float32Array(SPARK_COUNT * 3);
    const sparkLife = new Float32Array(SPARK_COUNT);
    for (let i = 0; i < SPARK_COUNT; i++) sparkPos[i*3 + 1] = -100;
    sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));

    const sparkMat = new THREE.PointsMaterial({
      color: 0xffcc44, size: 0.35, transparent: true, opacity: 1.0,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    const sparks = new THREE.Points(sparkGeo, sparkMat);
    sparks.frustumCulled = false;
    scene.add(sparks);

    /* ─────────────── DUST ─────────────── */
    const DUST_COUNT = 40;
    const dustGeo  = new THREE.BufferGeometry();
    const dustPos  = new Float32Array(DUST_COUNT * 3);
    const dustVel  = new Float32Array(DUST_COUNT * 3);
    const dustLife = new Float32Array(DUST_COUNT);
    for (let i = 0; i < DUST_COUNT; i++) dustPos[i*3 + 1] = -100;
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));

    const dustMat = new THREE.PointsMaterial({
      color: 0xc9b088, size: 0.24, transparent: true, opacity: 0.0,
      depthWrite: false
    });
    const dust = new THREE.Points(dustGeo, dustMat);
    dust.frustumCulled = false;
    scene.add(dust);

    /* ─────────────── PUBLIC TRIGGERS ─────────────── */
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
      sparkMat.color.setHex(colorHex || 0xffcc44);
      for (let i = 0; i < SPARK_COUNT; i++){
        sparkPos[i*3]     = x;
        sparkPos[i*3 + 1] = y;
        sparkPos[i*3 + 2] = z;
        const theta = Math.random() * Math.PI * 2;
        const phi   = Math.random() * Math.PI * 0.6;
        const sp    = 2 + Math.random() * 5;
        sparkVel[i*3]     = Math.sin(phi) * Math.cos(theta) * sp;
        sparkVel[i*3 + 1] = Math.abs(Math.cos(phi)) * sp * 1.3;
        sparkVel[i*3 + 2] = Math.sin(phi) * Math.sin(theta) * sp;
        sparkLife[i] = 0.6 + Math.random() * 0.5;
      }
      sparkGeo.attributes.position.needsUpdate = true;
    };

    window.fxDustPuff = function(x, y, z){
      for (let i = 0; i < DUST_COUNT; i++){
        dustPos[i*3]     = x + (Math.random() - 0.5) * 0.3;
        dustPos[i*3 + 1] = y + Math.random() * 0.05;
        dustPos[i*3 + 2] = z + (Math.random() - 0.5) * 0.3;
        const theta = Math.random() * Math.PI * 2;
        const sp    = 0.6 + Math.random() * 1.4;
        dustVel[i*3]     = Math.cos(theta) * sp;
        dustVel[i*3 + 1] = 1.6 + Math.random() * 1.5;
        dustVel[i*3 + 2] = Math.sin(theta) * sp;
        dustLife[i] = 0.7 + Math.random() * 0.4;
      }
      dustGeo.attributes.position.needsUpdate = true;
      dustMat.opacity = 0.85;
    };

    /* ─────────────── PER-FRAME UPDATE ─────────────── */
    window.updateParticles = function(dt){
      /* Trail sampling */
      if (trail.active && window.__cricmaxBallPos){
        const bp = window.__cricmaxBallPos;
        trail.cooldown -= dt;
        if (trail.cooldown <= 0){
          trail.cooldown = 0.014;
          for (let i = TRAIL_LEN - 1; i > 0; i--){
            trailPos[i*3]     = trailPos[(i-1)*3];
            trailPos[i*3 + 1] = trailPos[(i-1)*3 + 1];
            trailPos[i*3 + 2] = trailPos[(i-1)*3 + 2];
          }
          trailPos[0]     = bp.x;
          trailPos[1]     = bp.y;
          trailPos[2]     = bp.z;
          trailGeo.attributes.position.needsUpdate = true;
        }
      }

      /* Sparks physics */
      let sparkAlive = false;
      for (let i = 0; i < SPARK_COUNT; i++){
        if (sparkLife[i] > 0){
          sparkAlive = true;
          sparkLife[i] -= dt;
          sparkVel[i*3 + 1] -= 9.8 * dt;
          sparkPos[i*3]     += sparkVel[i*3]     * dt;
          sparkPos[i*3 + 1] += sparkVel[i*3 + 1] * dt;
          sparkPos[i*3 + 2] += sparkVel[i*3 + 2] * dt;
          if (sparkPos[i*3 + 1] < 0.05){
            sparkPos[i*3 + 1] = 0.05;
            sparkVel[i*3 + 1] *= -0.3;
          }
          if (sparkLife[i] <= 0) sparkPos[i*3 + 1] = -100;
        }
      }
      if (sparkAlive) sparkGeo.attributes.position.needsUpdate = true;

      /* Dust physics */
      let dustAlive = false;
      for (let i = 0; i < DUST_COUNT; i++){
        if (dustLife[i] > 0){
          dustAlive = true;
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
      if (dustAlive){
        dustGeo.attributes.position.needsUpdate = true;
        dustMat.opacity = 0.85;
      } else {
        dustMat.opacity = 0;
      }
    };

    console.log('[CricMax] ✅ Shot FX active (trail, sparks, dust)');
  }
};

})();

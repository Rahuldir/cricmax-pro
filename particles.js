/* ============================================================
   CricMax Pro — Particle FX System
   Dust clouds, grass debris, confetti, chalk puffs, sparks
   Exposes: window.CricMaxParticles
   Usage:
     const fx = CricMaxParticles.build(scene);
     fx.puffDust(x, y, z);
     fx.burstGrass(x, y, z);
     fx.confetti(x, y, z, count);
     fx.update(dt);
   ============================================================ */
(function(){
  'use strict';

  function texCanvas(w, h, draw){
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    return new THREE.CanvasTexture(c);
  }

  function build(scene){
    const handle = {};

    /* ---------------- DUST PUFf ---------------- */
    const dustTex = texCanvas(64, 64, (ctx, w, h) => {
      const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, 'rgba(200,180,150,0.85)');
      g.addColorStop(0.4, 'rgba(180,150,120,0.5)');
      g.addColorStop(1, 'rgba(150,120,90,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    });
    const DUST_POOL = 60;
    const dustPool = [];
    for (let i = 0; i < DUST_POOL; i++){
      const s = new THREE.Sprite(new THREE.SpriteMaterial({
        map: dustTex, transparent: true, opacity: 0,
        blending: THREE.NormalBlending, depthWrite: false
      }));
      s.scale.setScalar(0.5);
      s.userData = { life: 0, maxLife: 0.9, vel: new THREE.Vector3() };
      scene.add(s);
      dustPool.push(s);
    }
    let dustCursor = 0;

    /* ---------------- GRASS DEBRIS ---------------- */
    const grassGeo = new THREE.PlaneGeometry(0.18, 0.05);
    const grassMat = new THREE.MeshBasicMaterial({ color: 0x2b6531, side: THREE.DoubleSide, transparent: true, opacity: 0.95 });
    const GRASS_COUNT = 80;
    const grassInst = new THREE.InstancedMesh(grassGeo, grassMat, GRASS_COUNT);
    grassInst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const grassData = [];
    for (let i = 0; i < GRASS_COUNT; i++){
      const m = new THREE.Matrix4();
      m.setPosition(0, -100, 0);
      grassInst.setMatrixAt(i, m);
      grassData.push({
        life: 0, maxLife: 1.6,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        rot: new THREE.Euler(),
        rotVel: new THREE.Euler()
      });
    }
    scene.add(grassInst);

    /* ---------------- CONFETTI ---------------- */
    const confettiColors = [0xff3b3b, 0xffd93b, 0x3bff8f, 0x3ba7ff, 0xff3bff, 0xff8f3b];
    const confGeo = new THREE.PlaneGeometry(0.22, 0.1);
    const CONF_COUNT = 400;
    const confettiInstances = confettiColors.map(color => {
      const mat = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: 0 });
      const inst = new THREE.InstancedMesh(confGeo, mat, CONF_COUNT / confettiColors.length);
      inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      const m = new THREE.Matrix4(); m.setPosition(0, -100, 0);
      for (let i = 0; i < CONF_COUNT / confettiColors.length; i++) inst.setMatrixAt(i, m);
      scene.add(inst);
      return { inst, mat, count: CONF_COUNT / confettiColors.length, data: [] };
    });
    confettiInstances.forEach(c => {
      for (let i = 0; i < c.count; i++){
        c.data.push({ active: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(), rot: new THREE.Euler(), rotVel: new THREE.Euler() });
      }
    });

    /* ---------------- CHALK PUFF (bat-ball contact) ---------------- */
    const chalkTex = texCanvas(64, 64, (ctx, w, h) => {
      const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.3, 'rgba(255,240,200,0.85)');
      g.addColorStop(0.7, 'rgba(255,200,120,0.4)');
      g.addColorStop(1, 'rgba(255,180,80,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    });
    const CHALK_COUNT = 20;
    const chalkPool = [];
    for (let i = 0; i < CHALK_COUNT; i++){
      const s = new THREE.Sprite(new THREE.SpriteMaterial({
        map: chalkTex, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false
      }));
      s.scale.setScalar(0.4);
      s.userData = { life: 0, maxLife: 0.4, vel: new THREE.Vector3() };
      scene.add(s);
      chalkPool.push(s);
    }
    let chalkCursor = 0;

    /* ============================================================
       PUBLIC METHODS
       ============================================================ */

    handle.puffDust = function(x, y, z, count){
      const n = count || 12;
      for (let i = 0; i < n; i++){
        const s = dustPool[dustCursor];
        dustCursor = (dustCursor + 1) % DUST_POOL;
        s.position.set(x + (Math.random() - 0.5) * 0.3, y + 0.05, z + (Math.random() - 0.5) * 0.3);
        s.material.opacity = 0.7 + Math.random() * 0.2;
        s.scale.setScalar(0.4 + Math.random() * 0.4);
        s.userData.vel.set(
          (Math.random() - 0.5) * 1.2,
          0.4 + Math.random() * 0.6,
          (Math.random() - 0.5) * 1.2
        );
        s.userData.life = s.userData.maxLife;
      }
    };

    handle.burstGrass = function(x, y, z, count){
      const n = count || 30;
      let spawned = 0;
      for (let i = 0; i < GRASS_COUNT && spawned < n; i++){
        const g = grassData[i];
        if (g.life > 0) continue;
        spawned++;
        g.pos.set(x, y + 0.05, z);
        g.vel.set(
          (Math.random() - 0.5) * 5,
          2 + Math.random() * 4,
          (Math.random() - 0.5) * 5
        );
        g.rot.set(0, Math.random() * Math.PI * 2, 0);
        g.rotVel.set(
          (Math.random() - 0.5) * 12,
          (Math.random() - 0.5) * 12,
          (Math.random() - 0.5) * 12
        );
        g.life = g.maxLife;
      }
    };

    handle.confetti = function(x, y, z, count){
      const n = count || 200;
      confettiInstances.forEach(c => c.mat.opacity = 1);
      confettiInstances.forEach(c => {
        for (let i = 0; i < c.count && n > 0; i++){
          const d = c.data[i];
          if (d.active) continue;
          d.active = true;
          d.pos.set(x + (Math.random() - 0.5) * 4, y + Math.random() * 2, z + (Math.random() - 0.5) * 4);
          d.vel.set((Math.random() - 0.5) * 3, 3 + Math.random() * 3, (Math.random() - 0.5) * 3);
          d.rot.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
          d.rotVel.set((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6);
          n--;
          if (n <= 0) break;
        }
      });
    };

    handle.chalkPuff = function(x, y, z){
      for (let i = 0; i < 6; i++){
        const s = chalkPool[chalkCursor];
        chalkCursor = (chalkCursor + 1) % CHALK_COUNT;
        s.position.set(x, y, z);
        s.material.opacity = 1.0;
        s.scale.setScalar(0.3 + Math.random() * 0.4);
        s.userData.vel.set(
          (Math.random() - 0.5) * 1.5,
          0.5 + Math.random() * 0.5,
          (Math.random() - 0.5) * 1.5
        );
        s.userData.life = s.userData.maxLife;
      }
    };

    const _m = new THREE.Matrix4();
    const _q = new THREE.Quaternion();
    const _s = new THREE.Vector3(1, 1, 1);

    handle.update = function(dt){
      /* Dust */
      dustPool.forEach(s => {
        if (s.userData.life > 0){
          s.userData.life -= dt;
          const t = Math.max(0, s.userData.life / s.userData.maxLife);
          s.material.opacity = t * 0.75;
          s.position.addScaledVector(s.userData.vel, dt);
          s.userData.vel.y -= 1.2 * dt;
          s.scale.multiplyScalar(1 + dt * 0.8);
        }
      });

      /* Grass */
      for (let i = 0; i < GRASS_COUNT; i++){
        const g = grassData[i];
        if (g.life > 0){
          g.life -= dt;
          g.vel.y -= 9.8 * dt * 0.6;
          g.pos.addScaledVector(g.vel, dt);
          g.rot.x += g.rotVel.x * dt;
          g.rot.y += g.rotVel.y * dt;
          g.rot.z += g.rotVel.z * dt;
          if (g.pos.y < 0.02){ g.pos.y = 0.02; g.vel.y *= -0.3; g.vel.x *= 0.7; g.vel.z *= 0.7; }
          _q.setFromEuler(g.rot);
          _m.compose(g.pos, _q, _s);
          grassInst.setMatrixAt(i, _m);
        } else {
          _m.identity();
          _m.setPosition(0, -100, 0);
          grassInst.setMatrixAt(i, _m);
        }
      }
      grassInst.instanceMatrix.needsUpdate = true;

      /* Confetti */
      confettiInstances.forEach(c => {
        let anyActive = false;
        for (let i = 0; i < c.count; i++){
          const d = c.data[i];
          if (!d.active) continue;
          anyActive = true;
          d.vel.y -= 4 * dt;
          d.pos.addScaledVector(d.vel, dt);
          d.rot.x += d.rotVel.x * dt;
          d.rot.y += d.rotVel.y * dt;
          d.rot.z += d.rotVel.z * dt;
          if (d.pos.y < 0.02){ d.pos.y = 0.02; d.vel.y = 0; d.vel.x *= 0.9; d.vel.z *= 0.9; }
          _q.setFromEuler(d.rot);
          _m.compose(d.pos, _q, _s);
          c.inst.setMatrixAt(i, _m);
          if (d.pos.y <= 0.03 && Math.abs(d.vel.y) < 0.2){
            d.active = false;
            _m.identity();
            _m.setPosition(0, -100, 0);
            c.inst.setMatrixAt(i, _m);
          }
        }
        c.inst.instanceMatrix.needsUpdate = true;
        if (!anyActive) c.mat.opacity = 0;
      });

      /* Chalk */
      chalkPool.forEach(s => {
        if (s.userData.life > 0){
          s.userData.life -= dt;
          const t = Math.max(0, s.userData.life / s.userData.maxLife);
          s.material.opacity = t;
          s.position.addScaledVector(s.userData.vel, dt);
          s.userData.vel.multiplyScalar(1 - dt * 2);
          s.scale.multiplyScalar(1 + dt * 1.5);
        }
      });
    };

    console.log('✨ Particles built');
    return handle;
  }

  window.CricMaxParticles = { build };
})();

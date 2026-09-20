/* ═══════════════════════════════════════════════════════════════════════
   CricMax — Player Upgrades
   Subsurface skin, jersey numbers, facial features, better gloves,
   umpires, fielder chatter, sweat/dirt, stance & bowler variety.
   ═══════════════════════════════════════════════════════════════════════ */
(function(){
'use strict';

window.CricMaxPlayerUpgrades = {
  build: function(scene, renderer, camera) {

    const upgradeState = {
      players: [],
      umpires: [],
      nextJerseyNum: 7
    };

    /* ─────────────── 1. SUBSURFACE SKIN ───────────────
       Fakes light bleeding through skin with a warm fresnel rim
       injected into the fragment shader. No EffectComposer needed.
       Also boosts specularity slightly (real skin is never matte). */
    function applySubsurfaceSkin(mat){
      if (!mat || mat.userData.__sss) return;
      mat.userData.__sss = true;
      mat.roughness = 0.45;
      mat.metalness = 0.0;
      mat.emissive = new THREE.Color(0x2a0a05);
      mat.emissiveIntensity = 0.35;

      mat.onBeforeCompile = function(shader){
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <dithering_fragment>',
          `
          {
            vec3 viewDir = normalize(vViewPosition);
            float fres = pow(1.0 - abs(dot(normalize(vNormal), viewDir)), 2.5);
            gl_FragColor.rgb += vec3(0.28, 0.14, 0.08) * fres * 0.6;
          }
          #include <dithering_fragment>
          `
        );
      };
      mat.needsUpdate = true;
    }

    /* ─────────────── 2. JERSEY NUMBER ─────────────── */
    function makeNumberTexture(num){
      const c = document.createElement('canvas');
      c.width = c.height = 128;
      const ctx = c.getContext('2d');
      ctx.clearRect(0, 0, 128, 128);
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.lineWidth = 4;
      ctx.font = 'bold 88px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.strokeText(String(num), 64, 68);
      ctx.fillText(String(num), 64, 68);
      return new THREE.CanvasTexture(c);
    }

    function addJerseyNumber(rig){
      if (rig.userData.jerseyNumberAdded) return;
      rig.userData.jerseyNumberAdded = true;
      const num = rig.userData.jerseyNumber || (upgradeState.nextJerseyNum++);
      rig.userData.jerseyNumber = num;

      const tex = makeNumberTexture(num);
      const mat = new THREE.MeshBasicMaterial({
        map: tex, transparent: true, depthWrite: false, side: THREE.FrontSide
      });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.28), mat);
      mesh.position.set(0, 0.34, -0.22);
      mesh.rotation.y = Math.PI;
      rig.torso.add(mesh);
    }

    /* ─────────────── 3. FACIAL FEATURES ─────────────── */
    function addFacialFeatures(rig){
      if (rig.userData.facialAdded) return;
      rig.userData.facialAdded = true;

      const eyeWhite = new THREE.MeshStandardMaterial({ color: 0xf8f8f8, roughness: 0.35 });
      const eyeDark  = new THREE.MeshStandardMaterial({ color: 0x0a0a12, roughness: 0.15 });
      const mouthMat = new THREE.MeshStandardMaterial({ color: 0x6a2020, roughness: 0.7 });

      [-1, 1].forEach(side => {
        const g = new THREE.Group();
        g.position.set(side * 0.045, 0.02, 0.108);
        const w = new THREE.Mesh(new THREE.SphereGeometry(0.020, 8, 8), eyeWhite);
        w.scale.set(1, 0.75, 0.4);
        g.add(w);
        const p = new THREE.Mesh(new THREE.SphereGeometry(0.010, 6, 6), eyeDark);
        p.position.z = 0.012;
        g.add(p);
        rig.head.add(g);
      });

      const nose = new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.03, 6), rig.skinMat);
      nose.position.set(0, -0.005, 0.125);
      nose.rotation.x = Math.PI / 2;
      rig.head.add(nose);

      const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.006, 0.008), mouthMat);
      mouth.position.set(0, -0.048, 0.116);
      rig.head.add(mouth);
    }

    /* ─────────────── 4. BETTER GLOVES ─────────────── */
    function upgradeGloves(rig){
      if (rig.userData.glovesUpgraded) return;
      rig.userData.glovesUpgraded = true;

      const gloveMat = new THREE.MeshStandardMaterial({
        color: 0x1e40af, roughness: 0.6, metalness: 0.05
      });
      const strapMat = new THREE.MeshStandardMaterial({
        color: 0xf8fafc, roughness: 0.7
      });

      [rig.armL, rig.armR].forEach(arm => {
        for (let f = 0; f < 3; f++){
          const finger = new THREE.Mesh(
            new THREE.BoxGeometry(0.03, 0.012, 0.10), gloveMat
          );
          finger.position.set((f - 1) * 0.038, -0.68, -0.04);
          arm.add(finger);
        }
        const strap = new THREE.Mesh(
          new THREE.BoxGeometry(0.13, 0.02, 0.10), strapMat
        );
        strap.position.set(0, -0.58, 0);
        arm.add(strap);
      });
    }

    /* ─────────────── 5. SWEAT & DIRT ─────────────── */
    function addSweatMarks(rig){
      if (rig.userData.sweatAdded) return;
      rig.userData.sweatAdded = true;

      const stains = [];
      for (let i = 0; i < 3; i++){
        const mat = new THREE.MeshBasicMaterial({
          color: 0x3a2a1e, transparent: true, opacity: 0.0, depthWrite: false
        });
        const m = new THREE.Mesh(new THREE.PlaneGeometry(0.10, 0.14), mat);
        m.position.set((i - 1) * 0.08, 0.30, 0.19);
        rig.torso.add(m);
        stains.push(m);
      }
      rig.userData.sweatStains = stains;
    }

    /* ─────────────── 6. UMPIRES ─────────────── */
    function makeUmpire(x, z, facing){
      const g = new THREE.Group();
      const coatMat   = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.7 });
      const shirtMat  = new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.7 });
      const skinMat   = new THREE.MeshStandardMaterial({ color: 0xd4a373, roughness: 0.55 });
      applySubsurfaceSkin(skinMat);

      [-0.13, 0.13].forEach(xOff => {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.9, 8), coatMat);
        leg.position.set(xOff, 0.45, 0);
        leg.castShadow = true;
        g.add(leg);
      });

      const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.18, 0.62, 10), shirtMat);
      torso.position.y = 1.20;
      torso.castShadow = true;
      g.add(torso);

      const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 16), skinMat);
      head.position.y = 1.68;
      head.castShadow = true;
      g.add(head);

      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.06, 12), coatMat);
      cap.position.y = 1.78;
      g.add(cap);

      g.position.set(x, 0, z);
      g.rotation.y = facing || 0;
      scene.add(g);
      return g;
    }

    /* ─────────────── 7. PLAYER DETECTION ─────────────── */
    function isPlayerRig(obj){
      return obj && obj.isGroup &&
             obj.torso && obj.head && obj.legL && obj.legR &&
             obj.armL && obj.armR && obj.jerseyMat && obj.skinMat &&
             !obj.userData.__cricmaxEnhanced;
    }

    function enhancePlayer(rig){
      rig.userData.__cricmaxEnhanced = true;
      applySubsurfaceSkin(rig.skinMat);
      addJerseyNumber(rig);
      addFacialFeatures(rig);
      upgradeGloves(rig);
      addSweatMarks(rig);
      upgradeState.players.push(rig);
    }

    /* ─────────────── 8. SCAN LOOP ─────────────── */
    let scanCount = 0;
    const scanTimer = setInterval(function(){
      scanCount++;
      let found = 0;
      scene.traverse(obj => {
        if (isPlayerRig(obj)){ enhancePlayer(obj); found++; }
      });
      if (found > 0){
        console.info('[CricMax] Enhanced ' + found + ' player(s) — total ' + upgradeState.players.length);
      }
      if (scanCount > 40) clearInterval(scanTimer);
    }, 500);

    /* Immediate pass in case players already exist */
    scene.traverse(obj => { if (isPlayerRig(obj)) enhancePlayer(obj); });

    /* ─────────────── 9. UMPIRES ─────────────── */
    const bowlerUmpire = makeUmpire(0.9, -11.2, 0);
    const squareUmpire = makeUmpire(-13.5, 0, Math.PI / 2);
    upgradeState.umpires.push(bowlerUmpire, squareUmpire);

    /* ─────────────── 10. PUBLIC API ─────────────── */

    /* Bat pickup — torso bends forward, right arm reaches down */
    window.playBatPickup = function(rig){
      if (!rig || !rig.torso) return;
      const start = performance.now();
      const dur = 800;
      const origRot = rig.torso.rotation.x;
      const origArm = rig.armR.rotation.x;
      function anim(){
        const t = (performance.now() - start) / dur;
        if (t >= 1){
          rig.torso.rotation.x = origRot;
          rig.armR.rotation.x = origArm;
          return;
        }
        rig.torso.rotation.x = origRot + Math.sin(t * Math.PI) * 0.5;
        rig.armR.rotation.x = origArm - Math.sin(t * Math.PI) * 1.2;
        requestAnimationFrame(anim);
      }
      anim();
    };

    /* Batting stance mirroring (right / left handed) */
    window.setBatsmanStance = function(rig, hand){
      if (!rig) return;
      const absX = Math.abs(rig.scale.x);
      rig.scale.x = hand === 'left' ? -absX : absX;
      rig.userData.stance = hand === 'left' ? 'left' : 'right';
    };

    /* Bowler run-up style data for engine integration */
    window.bowlerRunUpStyles = {
      sling:   { armStart: -Math.PI * 2.5, armSpeed: 5.0, torsoTwist: 0.35, bounce: 0.08 },
      high:    { armStart: -Math.PI * 3.0, armSpeed: 4.0, torsoTwist: 0.20, bounce: 0.05 },
      sidearm: { armStart: -Math.PI * 2.0, armSpeed: 6.0, torsoTwist: 0.55, bounce: 0.12 }
    };

    /* ─────────────── 11. PER-FRAME UPDATE ─────────────── */
    let chatTimer = 0;
    window.updatePlayerUpgrades = function(dt){
      chatTimer += dt;
      if (chatTimer > 0.15){
        chatTimer = 0;
        const t = performance.now() * 0.001;
        for (let i = 0; i < upgradeState.players.length; i++){
          const rig = upgradeState.players[i];
          const phase = i * 1.7;
          /* Subtle head turns — fielder chatter */
          if (rig.head && !rig.userData.__cricmaxNoChatter){
            rig.head.rotation.y = Math.sin(t * 0.7 + phase) * 0.15;
          }
          /* Occasional arm shuffle */
          if (rig.armR){
            const twitch = Math.sin(t * 1.3 + phase * 2);
            if (twitch > 0.7){
              rig.armR.rotation.z = (twitch - 0.7) * 0.5;
            } else {
              rig.armR.rotation.z *= 0.9;
            }
          }
        }
      }

      /* Progressive sweat — ramps over ~10 minutes of runtime */
      const sweat = Math.min(1, performance.now() / 600000);
      for (let i = 0; i < upgradeState.players.length; i++){
        const stains = upgradeState.players[i].userData.sweatStains;
        if (stains){
          for (let s = 0; s < stains.length; s++){
            stains[s].material.opacity = sweat * (0.35 - s * 0.08);
          }
        }
      }
    };

    console.log('[CricMax] ✅ Player Upgrades active');
  }
};

})();

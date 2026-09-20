/* ═══════════════════════════════════════════════════════════════════════
   CricMax — Render Boost
   Single-file visual overhaul: stadium bowl, crowd, floodlights,
   detailed pitch, atmospheric sky. Loads AFTER stadium.js.
   ═══════════════════════════════════════════════════════════════════════ */
(function(){
'use strict';

window.CricMaxRenderBoost = {
  build: function(scene, renderer, camera) {

    /* ─────────────────────────────────────────────────────────────
       1. STADIUM BOWL  (multi-tier stands with packed crowd)
       ───────────────────────────────────────────────────────────── */
    function buildStadiumBowl(){
      const bowlGroup = new THREE.Group();
      scene.add(bowlGroup);

      /* Concrete structure — 3 tiers of seating */
      const tierConfig = [
        { rInner: 68, rOuter: 82, y: 2,  h: 6,  rows: 10 },
        { rInner: 84, rOuter: 98, y: 9,  h: 8,  rows: 12 },
        { rInner: 100, rOuter: 116, y: 18, h: 9, rows: 14 }
      ];

      const concreteMat = new THREE.MeshStandardMaterial({
        color: 0x2a3342, roughness: 0.95, metalness: 0.05
      });

      tierConfig.forEach(tier => {
        /* Solid ring (the stand structure) */
        const ringGeo = new THREE.RingGeometry(tier.rInner, tier.rOuter, 64);
        const ringMesh = new THREE.Mesh(ringGeo, concreteMat);
        ringMesh.rotation.x = -Math.PI / 2;
        ringMesh.position.y = tier.y;
        ringMesh.receiveShadow = true;
        bowlGroup.add(ringMesh);

        /* Vertical face (what you see from the pitch) */
        const faceGeo = new THREE.CylinderGeometry(
          tier.rInner, tier.rInner, tier.h, 64, 1, true
        );
        const faceMesh = new THREE.Mesh(faceGeo, concreteMat);
        faceMesh.position.y = tier.y + tier.h / 2;
        faceMesh.material.side = THREE.DoubleSide;
        bowlGroup.add(faceMesh);
      });

      /* Roof ring (dark canopy over top tier) */
      const roofGeo = new THREE.RingGeometry(116, 132, 64);
      const roofMat = new THREE.MeshStandardMaterial({
        color: 0x0f172a, roughness: 0.7, metalness: 0.3
      });
      const roof = new THREE.Mesh(roofGeo, roofMat);
      roof.rotation.x = -Math.PI / 2;
      roof.position.y = 27;
      bowlGroup.add(roof);

      return bowlGroup;
    }

    /* ─────────────────────────────────────────────────────────────
       2. PACKED CROWD  (InstancedMesh — 24,000 spectators @ 60fps)
       ───────────────────────────────────────────────────────────── */
    function buildCrowd(){
      const TOTAL = 24000;
      const bodyGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.55, 5);
      const headGeo = new THREE.SphereGeometry(0.13, 6, 5);
      const bodyMat = new THREE.MeshStandardMaterial({ roughness: 0.85 });
      const headMat = new THREE.MeshStandardMaterial({
        color: 0xd4a373, roughness: 0.7
      });

      const bodies = new THREE.InstancedMesh(bodyGeo, bodyMat, TOTAL);
      const heads  = new THREE.InstancedMesh(headGeo, headMat, TOTAL);
      bodies.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      heads.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

      const dummy = new THREE.Object3D();
      const col   = new THREE.Color();
      const palette = [
        0x0284c7, 0xdc2626, 0xfbbf24, 0x00e676,
        0xffffff, 0x1e293b, 0xef4444, 0x22d3ee,
        0x8b5cf6, 0xf97316
      ];
      const seatRanges = [
        { rMin: 69, rMax: 82, yMin: 2.5,  yMax: 8,   count: 8000 },
        { rMin: 85, rMax: 98, yMin: 9.5,  yMax: 17,  count: 8000 },
        { rMin: 101, rMax: 116, yMin: 18.5, yMax: 27, count: 8000 }
      ];

      /* Store per-instance base Y for bobbing animation */
      const baseY = new Float32Array(TOTAL);
      const phase = new Float32Array(TOTAL);

      let idx = 0;
      seatRanges.forEach(range => {
        for (let i = 0; i < range.count; i++, idx++){
          const angle = Math.random() * Math.PI * 2;
          const r = range.rMin + Math.random() * (range.rMax - range.rMin);
          const y = range.yMin + Math.random() * (range.yMax - range.yMin);

          dummy.position.set(Math.cos(angle) * r, y, Math.sin(angle) * r);
          dummy.rotation.y = -angle + Math.PI / 2;
          dummy.scale.setScalar(0.85 + Math.random() * 0.35);
          dummy.updateMatrix();

          bodies.setMatrixAt(idx, dummy.matrix);
          /* Head sits slightly above body */
          dummy.position.y = y + 0.42 * dummy.scale.x;
          dummy.updateMatrix();
          heads.setMatrixAt(idx, dummy.matrix);

          col.setHex(palette[(Math.random() * palette.length) | 0]);
          bodies.setColorAt(idx, col);

          baseY[idx] = y;
          phase[idx] = Math.random() * Math.PI * 2;
        }
      });

      bodies.instanceMatrix.needsUpdate = true;
      heads.instanceMatrix.needsUpdate = true;
      if (bodies.instanceColor) bodies.instanceColor.needsUpdate = true;

      scene.add(bodies);
      scene.add(heads);

      /* Animated bobbing — subtle wave through the crowd */
      const dummy2 = new THREE.Object3D();
      window.updateCrowd = function(dt){
        const t = performance.now() * 0.001;
        /* Only update a rolling window per frame to keep it cheap */
        const frameStep = 400;
        if (!window.__crowdCursor) window.__crowdCursor = 0;
        const start = window.__crowdCursor;
        const end = Math.min(start + frameStep, TOTAL);

        for (let i = start; i < end; i++){
          const baseIdx = i;
          const wave = Math.sin(t * 1.4 + phase[baseIdx]) * 0.06;
          /* Read existing matrix & offset Y */
          bodies.getMatrixAt(baseIdx, dummy2.matrix);
          dummy2.matrix.decompose(dummy2.position, dummy2.quaternion, dummy2.scale);
          dummy2.position.y = baseY[baseIdx] + wave;
          dummy2.updateMatrix();
          bodies.setMatrixAt(baseIdx, dummy2.matrix);
          /* Head follows */
          dummy2.position.y += 0.42 * dummy2.scale.x;
          dummy2.updateMatrix();
          heads.setMatrixAt(baseIdx, dummy2.matrix);
        }
        bodies.instanceMatrix.needsUpdate = true;
        heads.instanceMatrix.needsUpdate = true;
        window.__crowdCursor = end >= TOTAL ? 0 : end;
      };

      console.log('[CricMax] Crowd: ' + TOTAL + ' instances created');
    }

    /* ─────────────────────────────────────────────────────────────
       3. FLOODLIGHTS  (4 pylons with SpotLights + emissive panels)
       ───────────────────────────────────────────────────────────── */
    function buildFloodlights(){
      const group = new THREE.Group();
      scene.add(group);
      const spots = [];

      const positions = [
        { x:  72, z:  72 }, { x: -72, z:  72 },
        { x:  72, z: -72 }, { x: -72, z: -72 }
      ];

      positions.forEach(pos => {
        /* Pylon */
        const pylonGeo = new THREE.CylinderGeometry(0.6, 1.2, 46, 8);
        const pylonMat = new THREE.MeshStandardMaterial({
          color: 0x475569, roughness: 0.55, metalness: 0.8
        });
        const pylon = new THREE.Mesh(pylonGeo, pylonMat);
        pylon.position.set(pos.x, 23, pos.z);
        pylon.castShadow = true;
        group.add(pylon);

        /* Light panel cluster */
        const panelGeo = new THREE.BoxGeometry(5.5, 3, 0.6);
        const panelMat = new THREE.MeshStandardMaterial({
          color: 0x0f172a,
          emissive: 0xfff5e6,
          emissiveIntensity: 0
        });
        const panel = new THREE.Mesh(panelGeo, panelMat);
        panel.position.set(pos.x, 46, pos.z);
        panel.lookAt(0, 0, 0);
        group.add(panel);

        /* Real SpotLight */
        const spot = new THREE.SpotLight(0xfff8e7, 0, 220, Math.PI / 3.5, 0.55, 1.2);
        spot.position.set(pos.x, 46, pos.z);
        spot.target.position.set(0, 0, 0);
        spot.castShadow = true;
        spot.shadow.mapSize.width = 1024;
        spot.shadow.mapSize.height = 1024;
        spot.shadow.camera.near = 5;
        spot.shadow.camera.far = 200;
        spot.shadow.bias = -0.0002;
        group.add(spot);
        group.add(spot.target);

        spots.push({ spot, panel: panelMat });
      });

      /* Expose a controller so the sky menu can toggle them */
      window.__cricmaxFloodlights = spots;
    }

    /* ─────────────────────────────────────────────────────────────
       4. DETAILED PITCH  (worn strip + creases + 30-yard circle)
       ───────────────────────────────────────────────────────────── */
    function buildPitch(){
      /* Worn clay-textured pitch strip */
      const cv = document.createElement('canvas');
      cv.width = 128; cv.height = 1024;
      const ctx = cv.getContext('2d');
      const baseGrad = ctx.createLinearGradient(0, 0, 0, 1024);
      baseGrad.addColorStop(0,    '#b39a72');
      baseGrad.addColorStop(0.45, '#c9b088');
      baseGrad.addColorStop(0.55, '#c9b088');
      baseGrad.addColorStop(1,    '#b39a72');
      ctx.fillStyle = baseGrad;
      ctx.fillRect(0, 0, 128, 1024);

      /* Grain noise */
      for (let i = 0; i < 6000; i++){
        ctx.fillStyle = Math.random() > 0.5
          ? 'rgba(120,95,65,0.35)'
          : 'rgba(210,185,140,0.28)';
        ctx.fillRect(Math.random() * 128, Math.random() * 1024, 1, 2);
      }
      /* Length-wise cracks */
      for (let i = 0; i < 40; i++){
        ctx.strokeStyle = 'rgba(80,60,40,0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        const x0 = Math.random() * 128;
        ctx.moveTo(x0, Math.random() * 1024);
        for (let s = 0; s < 6; s++){
          ctx.lineTo(x0 + (Math.random() - 0.5) * 8, Math.random() * 1024);
        }
        ctx.stroke();
      }
      const pitchTex = new THREE.CanvasTexture(cv);
      pitchTex.anisotropy = 4;

      const pitchMat = new THREE.MeshStandardMaterial({
        map: pitchTex, roughness: 0.98, metalness: 0.0
      });
      const pitch = new THREE.Mesh(new THREE.PlaneGeometry(3.05, 22), pitchMat);
      pitch.rotation.x = -Math.PI / 2;
      pitch.position.y = 0.03;
      pitch.receiveShadow = true;
      scene.add(pitch);

      /* Crease lines */
      const creaseMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      function addCrease(zPos){
        const g = new THREE.PlaneGeometry(2.6, 0.08);
        const m = new THREE.Mesh(g, creaseMat);
        m.rotation.x = -Math.PI / 2;
        m.position.set(0, 0.035, zPos);
        scene.add(m);
      }
      addCrease( 8.8);  addCrease( 8.8 - 1.22);
      addCrease(-8.8);  addCrease(-8.8 + 1.22);

      /* Return creases (short lines perpendicular) */
      function addReturn(zPos){
        [-1.32, 1.32].forEach(x => {
          const g = new THREE.PlaneGeometry(0.08, 1.22);
          const m = new THREE.Mesh(g, creaseMat);
          m.rotation.x = -Math.PI / 2;
          m.position.set(x, 0.035, zPos + 0.61);
          scene.add(m);
        });
      }
      addReturn(8.8 - 1.22);
      addReturn(-8.8);

      /* 30-yard circle (dashed) */
      const circleMat = new THREE.LineDashedMaterial({
        color: 0xffffff, dashSize: 0.8, gapSize: 0.5, opacity: 0.55, transparent: true
      });
      const circlePts = [];
      for (let a = 0; a <= Math.PI * 2; a += 0.02){
        circlePts.push(new THREE.Vector3(Math.cos(a) * 25, 0.04, Math.sin(a) * 25));
      }
      const circleGeo = new THREE.BufferGeometry().setFromPoints(circlePts);
      const circleLine = new THREE.Line(circleGeo, circleMat);
      circleLine.computeLineDistances();
      scene.add(circleLine);

      /* Boundary rope (thick torus) */
      const ropeGeo = new THREE.TorusGeometry(66, 0.18, 8, 96);
      const ropeMat = new THREE.MeshStandardMaterial({
        color: 0xffffff, roughness: 0.6
      });
      const rope = new THREE.Mesh(ropeGeo, ropeMat);
      rope.rotation.x = -Math.PI / 2;
      rope.position.y = 0.15;
      rope.receiveShadow = true;
      scene.add(rope);

      /* Second rope marker (red — 30yd) */
      const rope2Geo = new THREE.TorusGeometry(25, 0.08, 6, 64);
      const rope2Mat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.7 });
      const rope2 = new THREE.Mesh(rope2Geo, rope2Mat);
      rope2.rotation.x = -Math.PI / 2;
      rope2.position.y = 0.09;
      scene.add(rope2);
    }

    /* ─────────────────────────────────────────────────────────────
       5. SKY DOME + ATMOSPHERE
       ───────────────────────────────────────────────────────────── */
    function buildSky(){
      const cv = document.createElement('canvas');
      cv.width = 16; cv.height = 512;
      const ctx = cv.getContext('2d');
      const grad = ctx.createLinearGradient(0, 0, 0, 512);
      grad.addColorStop(0.00, '#01030a');
      grad.addColorStop(0.35, '#0a2540');
      grad.addColorStop(0.62, '#2d6b8f');
      grad.addColorStop(0.82, '#7ba7bf');
      grad.addColorStop(1.00, '#c9d8e2');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 16, 512);

      const tex = new THREE.CanvasTexture(cv);
      tex.mapping = THREE.EquirectangularReflectionMapping;
      const skyMat = new THREE.MeshBasicMaterial({
        map: tex, side: THREE.BackSide, depthWrite: false, fog: false
      });
      const sky = new THREE.Mesh(new THREE.SphereGeometry(340, 32, 24), skyMat);
      scene.add(sky);
      window.__cricmaxSky = sky;

      /* Distant tree/building silhouette ring */
      const silGeo = new THREE.CylinderGeometry(125, 125, 18, 48, 1, true);
      const silMat = new THREE.MeshBasicMaterial({
        color: 0x0a1828, side: THREE.DoubleSide, transparent: true, opacity: 0.95
      });
      const sil = new THREE.Mesh(silGeo, silMat);
      sil.position.y = 8;
      scene.add(sil);
    }

    /* ─────────────────────────────────────────────────────────────
       6. LIGHTING UPGRADE
       ───────────────────────────────────────────────────────────── */
    function upgradeLighting(){
      /* Remove any existing ambient, set up hemisphere */
      const hemi = new THREE.HemisphereLight(0xa8d8ff, 0x1a4a2e, 0.65);
      scene.add(hemi);

      /* Main sun — key light */
      const sun = new THREE.DirectionalLight(0xfff2d8, 1.35);
      sun.position.set(60, 80, 40);
      sun.castShadow = true;
      sun.shadow.mapSize.set(2048, 2048);
      sun.shadow.camera.near = 0.5;
      sun.shadow.camera.far = 250;
      sun.shadow.camera.left = -90;
      sun.shadow.camera.right = 90;
      sun.shadow.camera.top = 90;
      sun.shadow.camera.bottom = -90;
      sun.shadow.bias = -0.00015;
      sun.shadow.normalBias = 0.025;
      scene.add(sun);
      window.__cricmaxSun = sun;

      /* Cool fill from opposite side */
      const fill = new THREE.DirectionalLight(0x88a8ff, 0.3);
      fill.position.set(-50, 40, -60);
      scene.add(fill);

      /* Subtle rim from behind camera */
      const rim = new THREE.DirectionalLight(0xffffff, 0.15);
      rim.position.set(0, 30, 100);
      scene.add(rim);
    }

    /* ─────────────────────────────────────────────────────────────
       7. RENDERER UPGRADES (tone mapping, sRGB, fog)
       ───────────────────────────────────────────────────────────── */
    function upgradeRenderer(){
      renderer.outputEncoding = THREE.sRGBEncoding;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.15;
      renderer.physicallyCorrectLights = false;
      scene.fog = new THREE.FogExp2(0x0a2540, 0.0035);
    }

    /* ─────────────────────────────────────────────────────────────
       8. HOOK setSky() TO FLOODLIGHTS + SKY COLOR
       ───────────────────────────────────────────────────────────── */
    function wireSkyControl(){
      const original = window.setSky || function(){};
      window.setSky = function(mode){
        /* Toggle floodlights */
        if (window.__cricmaxFloodlights){
          window.__cricmaxFloodlights.forEach(f => {
            const target = (mode === 'night') ? 2.2 : 0;
            f.spot.intensity = target;
            f.panel.emissiveIntensity = (mode === 'night') ? 1.6 : 0;
          });
        }
        /* Sun intensity by time of day */
        if (window.__cricmaxSun){
          window.__cricmaxSun.intensity = mode === 'night' ? 0.08
                                       : mode === 'sunset' ? 0.9
                                       : 1.35;
          window.__cricmaxSun.color.setHex(
            mode === 'sunset' ? 0xff8844 : 0xfff2d8
          );
        }
        /* Scene mood */
        if (mode === 'night'){
          scene.background = new THREE.Color(0x01030a);
          scene.fog.color.setHex(0x01030a);
        } else if (mode === 'sunset'){
          scene.background = new THREE.Color(0x2a1535);
          scene.fog.color.setHex(0x2a1535);
        } else {
          scene.background = new THREE.Color(0x050d24);
          scene.fog.color.setHex(0x0a2540);
        }
        /* Chain to original */
        original(mode);
      };
    }

    /* ─────────────────────────────────────────────────────────────
       RUN ALL BUILDERS
       ───────────────────────────────────────────────────────────── */
    upgradeRenderer();
    buildSky();
    upgradeLighting();
    buildStadiumBowl();
    buildCrowd();
    buildFloodlights();
    buildPitch();
    wireSkyControl();

    console.log('[CricMax] ✅ Render Boost active — bowl, crowd, floodlights, pitch, sky');
  }
};

})();

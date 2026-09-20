/* ═══════════════════════════════════════════════════════════════════════
   CricMax — Render Boost (BRIGHTNESS-FIXED v2)
   ═══════════════════════════════════════════════════════════════════════ */
(function(){
'use strict';

window.CricMaxRenderBoost = {
  build: function(scene, renderer, camera) {

    /* ─────────────────────────────────────────────────────────────
       0. KILL ALL PREVIOUS LIGHTS  (prevents stacking / overexposure)
       ───────────────────────────────────────────────────────────── */
    const oldLights = [];
    scene.traverse(o => { if (o.isLight) oldLights.push(o); });
    oldLights.forEach(l => { if (l.parent) l.parent.remove(l); });
    console.log('[CricMax] Removed ' + oldLights.length + ' pre-existing lights');

    /* ─────────────────────────────────────────────────────────────
       1. STADIUM BOWL
       ───────────────────────────────────────────────────────────── */
    (function buildStadiumBowl(){
      const bowlGroup = new THREE.Group();
      scene.add(bowlGroup);

      const tierConfig = [
        { rInner: 68,  rOuter: 82,  y: 2,  h: 6, rows: 10 },
        { rInner: 84,  rOuter: 98,  y: 9,  h: 8, rows: 12 },
        { rInner: 100, rOuter: 116, y: 18, h: 9, rows: 14 }
      ];

      const concreteMat = new THREE.MeshStandardMaterial({
        color: 0x1f2733, roughness: 0.98, metalness: 0.02
      });

      tierConfig.forEach(tier => {
        const ringGeo = new THREE.RingGeometry(tier.rInner, tier.rOuter, 64);
        const ringMesh = new THREE.Mesh(ringGeo, concreteMat);
        ringMesh.rotation.x = -Math.PI / 2;
        ringMesh.position.y = tier.y;
        ringMesh.receiveShadow = true;
        bowlGroup.add(ringMesh);

        const faceGeo = new THREE.CylinderGeometry(
          tier.rInner, tier.rInner, tier.h, 64, 1, true
        );
        const faceMesh = new THREE.Mesh(faceGeo, concreteMat);
        faceMesh.position.y = tier.y + tier.h / 2;
        faceMesh.material.side = THREE.DoubleSide;
        bowlGroup.add(faceMesh);
      });

      const roof = new THREE.Mesh(
        new THREE.RingGeometry(116, 132, 64),
        new THREE.MeshStandardMaterial({ color: 0x0a1018, roughness: 0.75, metalness: 0.25 })
      );
      roof.rotation.x = -Math.PI / 2;
      roof.position.y = 27;
      bowlGroup.add(roof);
    })();

    /* ─────────────────────────────────────────────────────────────
       2. PACKED CROWD  (colors properly applied)
       ───────────────────────────────────────────────────────────── */
    (function buildCrowd(){
      const TOTAL = 18000;
      const bodyGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.55, 5);
      const headGeo = new THREE.SphereGeometry(0.13, 6, 5);

      /* IMPORTANT: base color MUST be white so instanceColor multiplies correctly */
      const bodyMat = new THREE.MeshStandardMaterial({
        color: 0xffffff, roughness: 0.9, metalness: 0.0
      });
      const headMat = new THREE.MeshStandardMaterial({
        color: 0xb08050, roughness: 0.8
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
        { rMin: 69,  rMax: 82,  yMin: 2.5,  yMax: 8,  count: 6000 },
        { rMin: 85,  rMax: 98,  yMin: 9.5,  yMax: 17, count: 6000 },
        { rMin: 101, rMax: 116, yMin: 18.5, yMax: 27, count: 6000 }
      ];

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

      const dummy2 = new THREE.Object3D();
      window.updateCrowd = function(dt){
        const t = performance.now() * 0.001;
        const frameStep = 400;
        if (!window.__crowdCursor) window.__crowdCursor = 0;
        const start = window.__crowdCursor;
        const end = Math.min(start + frameStep, TOTAL);

        for (let i = start; i < end; i++){
          const wave = Math.sin(t * 1.4 + phase[i]) * 0.06;
          bodies.getMatrixAt(i, dummy2.matrix);
          dummy2.matrix.decompose(dummy2.position, dummy2.quaternion, dummy2.scale);
          dummy2.position.y = baseY[i] + wave;
          dummy2.updateMatrix();
          bodies.setMatrixAt(i, dummy2.matrix);
          dummy2.position.y += 0.42 * dummy2.scale.x;
          dummy2.updateMatrix();
          heads.setMatrixAt(i, dummy2.matrix);
        }
        bodies.instanceMatrix.needsUpdate = true;
        heads.instanceMatrix.needsUpdate = true;
        window.__crowdCursor = end >= TOTAL ? 0 : end;
      };
    })();

    /* ─────────────────────────────────────────────────────────────
       3. FLOODLIGHTS  (default OFF — only for night)
       ───────────────────────────────────────────────────────────── */
    const floodlights = [];
    (function buildFloodlights(){
      const group = new THREE.Group();
      scene.add(group);

      const positions = [
        { x:  72, z:  72 }, { x: -72, z:  72 },
        { x:  72, z: -72 }, { x: -72, z: -72 }
      ];

      positions.forEach(pos => {
        const pylon = new THREE.Mesh(
          new THREE.CylinderGeometry(0.6, 1.2, 46, 8),
          new THREE.MeshStandardMaterial({ color: 0x2a3342, roughness: 0.6, metalness: 0.7 })
        );
        pylon.position.set(pos.x, 23, pos.z);
        pylon.castShadow = true;
        group.add(pylon);

        const panelMat = new THREE.MeshStandardMaterial({
          color: 0x0a0f18, emissive: 0xfff5e6, emissiveIntensity: 0
        });
        const panel = new THREE.Mesh(new THREE.BoxGeometry(5.5, 3, 0.6), panelMat);
        panel.position.set(pos.x, 46, pos.z);
        panel.lookAt(0, 0, 0);
        group.add(panel);

        const spot = new THREE.SpotLight(0xfff8e7, 0, 220, Math.PI / 3.5, 0.6, 1.2);
        spot.position.set(pos.x, 46, pos.z);
        spot.target.position.set(0, 0, 0);
        spot.castShadow = true;
        spot.shadow.mapSize.set(1024, 1024);
        spot.shadow.camera.near = 5;
        spot.shadow.camera.far = 200;
        spot.shadow.bias = -0.0002;
        group.add(spot);
        group.add(spot.target);

        floodlights.push({ spot, panel: panelMat });
      });
    })();
    window.__cricmaxFloodlights = floodlights;

    /* ─────────────────────────────────────────────────────────────
       4. PITCH + MARKINGS
       ───────────────────────────────────────────────────────────── */
    (function buildPitch(){
      const cv = document.createElement('canvas');
      cv.width = 128; cv.height = 1024;
      const ctx = cv.getContext('2d');
      const baseGrad = ctx.createLinearGradient(0, 0, 0, 1024);
      baseGrad.addColorStop(0,    '#8b7355');
      baseGrad.addColorStop(0.45, '#a08a68');
      baseGrad.addColorStop(0.55, '#a08a68');
      baseGrad.addColorStop(1,    '#8b7355');
      ctx.fillStyle = baseGrad;
      ctx.fillRect(0, 0, 128, 1024);

      for (let i = 0; i < 6000; i++){
        ctx.fillStyle = Math.random() > 0.5
          ? 'rgba(90,70,45,0.4)'
          : 'rgba(180,155,115,0.3)';
        ctx.fillRect(Math.random() * 128, Math.random() * 1024, 1, 2);
      }
      const pitchTex = new THREE.CanvasTexture(cv);
      pitchTex.anisotropy = 4;

      const pitch = new THREE.Mesh(
        new THREE.PlaneGeometry(3.05, 22),
        new THREE.MeshStandardMaterial({ map: pitchTex, roughness: 0.98 })
      );
      pitch.rotation.x = -Math.PI / 2;
      pitch.position.y = 0.03;
      pitch.receiveShadow = true;
      scene.add(pitch);

      /* Crease lines */
      const creaseMat = new THREE.MeshBasicMaterial({ color: 0xf0f0f0 });
      function addCrease(z){
        const m = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.08), creaseMat);
        m.rotation.x = -Math.PI / 2;
        m.position.set(0, 0.035, z);
        scene.add(m);
      }
      addCrease(8.8); addCrease(7.58);
      addCrease(-8.8); addCrease(-7.58);

      /* 30-yard circle */
      const circlePts = [];
      for (let a = 0; a <= Math.PI * 2; a += 0.02){
        circlePts.push(new THREE.Vector3(Math.cos(a) * 25, 0.04, Math.sin(a) * 25));
      }
      const circleLine = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(circlePts),
        new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: 0.8, gapSize: 0.5, opacity: 0.5, transparent: true })
      );
      circleLine.computeLineDistances();
      scene.add(circleLine);

      /* Boundary rope */
      const rope = new THREE.Mesh(
        new THREE.TorusGeometry(66, 0.18, 8, 96),
        new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.7 })
      );
      rope.rotation.x = -Math.PI / 2;
      rope.position.y = 0.15;
      rope.receiveShadow = true;
      scene.add(rope);
    })();

    /* ─────────────────────────────────────────────────────────────
       5. SKY DOME
       ───────────────────────────────────────────────────────────── */
    (function buildSky(){
      const cv = document.createElement('canvas');
      cv.width = 16; cv.height = 512;
      const ctx = cv.getContext('2d');
      const grad = ctx.createLinearGradient(0, 0, 0, 512);
      grad.addColorStop(0.00, '#020610');
      grad.addColorStop(0.35, '#0a1f38');
      grad.addColorStop(0.62, '#1e4d6b');
      grad.addColorStop(0.82, '#4d7894');
      grad.addColorStop(1.00, '#8fa8b8');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 16, 512);

      const tex = new THREE.CanvasTexture(cv);
      tex.mapping = THREE.EquirectangularReflectionMapping;

      const sky = new THREE.Mesh(
        new THREE.SphereGeometry(340, 32, 24),
        new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, depthWrite: false, fog: false })
      );
      scene.add(sky);

      const sil = new THREE.Mesh(
        new THREE.CylinderGeometry(125, 125, 18, 48, 1, true),
        new THREE.MeshBasicMaterial({ color: 0x0a1220, side: THREE.DoubleSide, transparent: true, opacity: 0.95 })
      );
      sil.position.y = 8;
      scene.add(sil);
    })();

    /* ─────────────────────────────────────────────────────────────
       6. LIGHTING — single clean rig, LOW intensity
       ───────────────────────────────────────────────────────────── */
    let sunLight = null;
    (function upgradeLighting(){
      /* Ambient bounce — HALVED from earlier version */
      const hemi = new THREE.HemisphereLight(0xa8d8ff, 0x1a3a25, 0.35);
      scene.add(hemi);

      /* Main sun — HALVED */
      sunLight = new THREE.DirectionalLight(0xfff2d8, 0.85);
      sunLight.position.set(60, 80, 40);
      sunLight.castShadow = true;
      sunLight.shadow.mapSize.set(2048, 2048);
      sunLight.shadow.camera.near = 0.5;
      sunLight.shadow.camera.far = 250;
      sunLight.shadow.camera.left = -90;
      sunLight.shadow.camera.right = 90;
      sunLight.shadow.camera.top = 90;
      sunLight.shadow.camera.bottom = -90;
      sunLight.shadow.bias = -0.00015;
      sunLight.shadow.normalBias = 0.025;
      scene.add(sunLight);

      /* Cool fill — very subtle */
      const fill = new THREE.DirectionalLight(0x88a8ff, 0.12);
      fill.position.set(-50, 40, -60);
      scene.add(fill);

      /* Rim — nearly off */
      const rim = new THREE.DirectionalLight(0xffffff, 0.06);
      rim.position.set(0, 30, 100);
      scene.add(rim);
    })();

    /* ─────────────────────────────────────────────────────────────
       7. RENDERER — DROPPED EXPOSURE
       ───────────────────────────────────────────────────────────── */
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.85;   /* ← was 1.15 — LOWERED */
    renderer.physicallyCorrectLights = false;
    scene.fog = new THREE.FogExp2(0x0a2540, 0.0035);

    /* ─────────────────────────────────────────────────────────────
       8. SKY MENU WIRING
       ───────────────────────────────────────────────────────────── */
    const original = window.setSky || function(){};
    window.setSky = function(mode){
      floodlights.forEach(f => {
        const target = (mode === 'night') ? 1.6 : 0;   /* was 2.2 */
        f.spot.intensity = target;
        f.panel.emissiveIntensity = (mode === 'night') ? 1.4 : 0;
      });
      if (sunLight){
        sunLight.intensity = mode === 'night' ? 0.05
                            : mode === 'sunset' ? 0.55
                            : 0.85;
        sunLight.color.setHex(mode === 'sunset' ? 0xff8844 : 0xfff2d8);
      }
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
      original(mode);
    };

    console.log('[CricMax] ✅ Render Boost v2 active (brightness-corrected)');
  }
};

})();

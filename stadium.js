/* ============================================================
   CricMax Pro — Stadium Engine (GLB, coordinate-aligned)
   Same public API as the original procedural stadium:
     window.CricMaxStadium = { build(scene), makeWoodTexture() }
   ------------------------------------------------------------
   Coordinate system used by the viewer (index.html):
     • grass / pitch at y = 0
     • pitch runs along Z, origin at pitch centre
     • stadium centred on origin
   ------------------------------------------------------------
   Coordinate / orientation values taken from working StadiumView:
     STADIUM_SIZE      = 200   (max dimension after scaling)
     BOUNDARY_RADIUS   = 38    (visual reference)
     TOWER_XZ / TOWER_Y= 82 / 46
     fieldY (raycast)  ≈ 7.20  (grass level inside the GLB)
   ============================================================ */
(function(){
  'use strict';

  console.log('%c[stadium.js] GLB / coord-aligned', 'color:#00e676;font-weight:bold');

  /* ── Device tier ────────────────────────────────────────── */
  const IS_MOBILE = /Android|iPhone|iPad|iPod|Mobile|Silk|Kindle|BlackBerry/i.test(navigator.userAgent || '')
                  || (navigator.maxTouchPoints > 1 && window.innerWidth < 900);

  /* ── Config (coordinates taken from working StadiumView) ── */
  const GLB_URL          = 'models/stadium.glb';
  const STADIUM_SIZE     = 200;        // max dimension of the GLB after scaling
  const MODEL_ROT_Y      = 0;          // radians — rotate if pitch is not along Z
  const ENABLE_DRACO     = true;
  const DRACO_PATH       = 'https://www.gstatic.com/draco/versioned/decoders/1.5.6/';

  /* Reference constants (kept for documentation / future use) */
  const BOUNDARY_RADIUS  = 38;
  const TOWER_XZ         = 82;
  const TOWER_Y          = 46;
  // eslint-disable-next-line no-unused-vars
  const FIELD_POSITIONS_REF = [
    { role:'Striker',     x: 0.4, z:  8.6 },
    { role:'Non-Striker', x:-1.2, z: -8.6 },
    { role:'Bowler',      x: 0.5, z:-24.0 },
    { role:'Keeper',      x: 0.0, z: 14.0 },
    { role:'Slip',        x: 3.0, z: 14.5 }
  ];

  /* ── Wood texture for bat + stumps (unchanged) ─────────── */
  function makeWoodTexture(){
    const c = document.createElement('canvas');
    c.width = 256; c.height = 512;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#e8d59e';
    ctx.fillRect(0, 0, 256, 512);
    for (let i = 0; i < 20; i++){
      ctx.strokeStyle = 'rgba(140,110,60,' + (Math.random()*0.35) + ')';
      ctx.lineWidth = Math.random() * 1.5 + 0.3;
      ctx.beginPath();
      let x = Math.random() * 256;
      ctx.moveTo(x, 0);
      for (let y = 0; y < 512; y += 20){
        x += (Math.random() - 0.5) * 6;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    const t = new THREE.CanvasTexture(c);
    t.anisotropy = 4;
    return t;
  }

  /* ── Model helpers ─────────────────────────────────────── */
  function scaleToMaxDim(model, targetMax){
    model.updateMatrixWorld(true);
    const box  = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim === 0) return 1;
    const s = targetMax / maxDim;
    model.scale.setScalar(s);
    model.updateMatrixWorld(true);
    return s;
  }

  function bottomToZero(model){
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);
    model.position.y -= box.min.y;
    model.updateMatrixWorld(true);
  }

  /* Raycast straight down at the pitch area to find the grass plane. */
  function findFieldY(stadium){
    const raycaster = new THREE.Raycaster();
    const down = new THREE.Vector3(0, -1, 0);
    const counts = {};
    for (let x = -15; x <= 15; x += 3){
      for (let z = -15; z <= 15; z += 3){
        raycaster.set(new THREE.Vector3(x, 300, z), down);
        const hits = raycaster.intersectObject(stadium, true);
        if (hits.length){
          const k = Math.round(hits[0].point.y * 10) / 10;
          counts[k] = (counts[k] || 0) + 1;
        }
      }
    }
    let bestY = 0, bestCount = 0;
    Object.keys(counts).forEach(function(k){
      if (counts[k] > bestCount){ bestCount = counts[k]; bestY = parseFloat(k); }
    });
    return (bestCount >= 3 && bestY > 0) ? bestY : 7.20;  // your GLB reports ~7.20
  }

  /* ============================================================
     BUILD
     ============================================================ */
  function build(scene){
    const handles = {
      root: null,
      ambient: null,
      hemi: null,
      sun: null,
      fieldY: 0,          // viewer sees grass at y=0
      grassShift: 0,      // how much we moved the GLB down
      ready: false,
      setSky: function(){},
      update: function(){}
    };

    /* ── Lighting (stadium-owned) ──────────────────────────── */
    const ambient = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambient);
    handles.ambient = ambient;

    const hemi = new THREE.HemisphereLight(0xffffff, 0x88aa88, 0.6);
    scene.add(hemi);
    handles.hemi = hemi;

    const sun = new THREE.DirectionalLight(0xffffff, 1.5);
    sun.position.set(80, 400, 80);
    sun.castShadow = !IS_MOBILE;
    scene.add(sun);
    handles.sun = sun;

    /* ── Sky presets (viewer calls setSky('day'|'sunset'|'night')) ── */
    handles.setSky = function(mode){
      if (mode === 'day'){
        if (scene.background && scene.background.set) scene.background.set(0x87b8e0);
        ambient.color.set(0xffffff); ambient.intensity = 0.8;
        hemi.color.set(0xffffff);   hemi.groundColor.set(0x88aa88); hemi.intensity = 0.6;
        sun.color.set(0xffffff);    sun.intensity = 1.5;
      } else if (mode === 'sunset'){
        if (scene.background && scene.background.set) scene.background.set(0xfd5e53);
        ambient.color.set(0xffa07a); ambient.intensity = 0.65;
        hemi.color.set(0xffb08a);   hemi.groundColor.set(0x4a2a20); hemi.intensity = 0.5;
        sun.color.set(0xffb070);    sun.intensity = 0.85;
      } else {
        if (scene.background && scene.background.set) scene.background.set(0x020713);
        ambient.color.set(0xd4e2ff); ambient.intensity = 0.45;
        hemi.color.set(0x8ba6d4);   hemi.groundColor.set(0x1a2030); hemi.intensity = 0.35;
        sun.color.set(0xdde8ff);    sun.intensity = 0.0;
      }
    };

    /* ── Load the GLB ─────────────────────────────────────── */
    if (typeof THREE.GLTFLoader === 'undefined'){
      console.error('[Stadium] THREE.GLTFLoader missing — add the GLTFLoader <script> in the HTML.');
      return handles;
    }

    const loader = new THREE.GLTFLoader();
    if (ENABLE_DRACO && typeof THREE.DRACOLoader === 'function'){
      try {
        const draco = new THREE.DRACOLoader();
        draco.setDecoderPath(DRACO_PATH);
        loader.setDRACOLoader(draco);
        console.log('[Stadium] DRACO attached');
      } catch(e){}
    }

    loader.load(
      GLB_URL,
      function(gltf){
        const model = gltf.scene || gltf.scenes[0];
        if (!model) return;

        /* 1. Scale so max dimension = STADIUM_SIZE (200). */
        scaleToMaxDim(model, STADIUM_SIZE);

        /* 2. Orient the pitch along +Z. */
        model.rotation.y = MODEL_ROT_Y;
        model.updateMatrixWorld(true);

        /* 3. Drop so the model's own bottom sits at y = 0. */
        bottomToZero(model);

        /* 4. Find where the grass actually is (GLB's grass is not at y=0). */
        const rawFieldY = findFieldY(model);
        console.log('[Stadium] raycast grass y =', rawFieldY.toFixed(2));

        /* 5. Shift the model so grass sits at y = 0, matching the viewer. */
        model.position.y -= rawFieldY;
        model.position.x = 0;
        model.position.z = 0;
        model.updateMatrixWorld(true);

        handles.grassShift = rawFieldY;
        handles.fieldY     = 0;         // the viewer always sees grass at 0

        /* 6. Shadows off, materials NEVER touched — grass/pitch stays visible. */
        model.traverse(function(c){
          if (c.isMesh){
            c.castShadow    = false;
            c.receiveShadow = false;
            c.frustumCulled = true;
          }
        });

        scene.add(model);
        handles.root  = model;
        handles.ready = true;

        if (typeof window.__cmProgress === 'function'){
          window.__cmProgress(70, 'STADIUM READY');
        }

        console.log(
          '%c[Stadium] ✅ GLB loaded · shifted down by ' + rawFieldY.toFixed(2) +
          ' · grass now at y=0',
          'color:#00e676'
        );
      },
      function(xhr){
        if (xhr.total && typeof window.__cmProgress === 'function'){
          const pct = 30 + (xhr.loaded / xhr.total) * 30;
          window.__cmProgress(
            pct,
            'LOADING STADIUM ' + Math.round((xhr.loaded / xhr.total) * 100) + '%'
          );
        }
      },
      function(err){
        console.error('[Stadium] ❌ GLB load failed:', err);
        console.error('[Stadium] Check that "' + GLB_URL + '" exists and is served over http(s).');
      }
    );

    return handles;
  }

  /* ── Export (same shape as before) ─────────────────────── */
  window.CricMaxStadium = {
    build: build,
    makeWoodTexture: makeWoodTexture
  };
})();

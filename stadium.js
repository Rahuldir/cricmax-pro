/* ============================================================
   CricMax Pro — Stadium Engine
   Self-contained 3D cricket stadium builder.
   Call: window.CricMaxStadium.build(scene) → returns handle
   ============================================================ */
(function(){
  'use strict';

  /* ------------------------------------------------------------
     PROCEDURAL TEXTURE FACTORY
     ------------------------------------------------------------ */
  function texCanvas(w, h, draw){
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.anisotropy = 4;
    return t;
  }

  function makeGrassTexture(){
    return texCanvas(2048, 2048, (ctx, w, h) => {
      const g = ctx.createRadialGradient(w/2, h/2, 80, w/2, h/2, w/2);
      g.addColorStop(0, '#2b6531');
      g.addColorStop(0.5, '#1e4b23');
      g.addColorStop(1, '#173f1b');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      // Alternating mow stripes
      for (let i = 0; i < 16; i++){
        if (i % 2 === 0){
          ctx.fillStyle = 'rgba(255,255,255,.025)';
          ctx.fillRect(0, (i / 16) * h, w, h / 16);
        }
      }
      // Grass noise
      for (let i = 0; i < 160000; i++){
        ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,.025)' : 'rgba(0,0,0,.05)';
        ctx.fillRect(Math.random()*w, Math.random()*h, 2, 2);
      }
    });
  }

  function makePitchTexture(){
    return texCanvas(512, 2048, (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#9b744a');
      g.addColorStop(0.15, '#a8815c');
      g.addColorStop(0.5, '#8b6a4a');
      g.addColorStop(0.85, '#a8815c');
      g.addColorStop(1, '#9b744a');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      // Bowler footholes
      for (const endY of [120, h - 120]){
        const rg = ctx.createRadialGradient(w/2, endY, 10, w/2, endY, 160);
        rg.addColorStop(0, 'rgba(60,40,20,.55)');
        rg.addColorStop(1, 'rgba(60,40,20,0)');
        ctx.fillStyle = rg;
        ctx.fillRect(0, 0, w, h);
      }
      // Cracks
      for (let c = 0; c < 8; c++){
        ctx.strokeStyle = 'rgba(40,25,10,.6)';
        ctx.lineWidth = Math.random() * 1.5 + 0.5;
        ctx.beginPath();
        let x = Math.random() * w;
        let y = Math.random() * h;
        ctx.moveTo(x, y);
        for (let s = 0; s < 6; s++){
          x += (Math.random() - 0.5) * 30;
          y += (Math.random() - 0.5) * 60;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      // Grain
      for (let i = 0; i < 8000; i++){
        ctx.fillStyle = 'rgba(0,0,0,' + (Math.random()*0.15) + ')';
        ctx.fillRect(Math.random()*w, Math.random()*h, 1, 1);
      }
    });
  }

  function makeWoodTexture(){
    return texCanvas(256, 512, (ctx, w, h) => {
      ctx.fillStyle = '#e8d59e';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 20; i++){
        ctx.strokeStyle = 'rgba(140,110,60,' + (Math.random()*0.35) + ')';
        ctx.lineWidth = Math.random() * 1.5 + 0.3;
        ctx.beginPath();
        let x = Math.random() * w;
        ctx.moveTo(x, 0);
        for (let y = 0; y < h; y += 20){
          x += (Math.random() - 0.5) * 6;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      for (let k = 0; k < 3; k++){
        const kx = Math.random() * w, ky = Math.random() * h;
        for (let r = 3; r < 18; r += 3){
          ctx.beginPath();
          ctx.arc(kx, ky, r, 0, Math.PI*2);
          ctx.strokeStyle = 'rgba(120,90,50,.4)';
          ctx.lineWidth = 0.7;
          ctx.stroke();
        }
      }
    });
  }

  function makeLEDTexture(){
    return texCanvas(2048, 128, (ctx, w, h) => {
      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, 0, w, h);
      const brands = ['CRICMAX PRO', 'LIVE ACTION', 'BOUNDARY CAM', 'SMART REVIEW', '6 OR OUT', 'HOWZAT!'];
      ctx.font = 'bold 52px -apple-system,sans-serif';
      ctx.textBaseline = 'middle';
      brands.forEach((b, i) => {
        const x = i * 340;
        ctx.fillStyle = i % 2 ? '#38bdf8' : '#00e676';
        ctx.fillText(b, x, 64);
      });
    });
  }

  /* ------------------------------------------------------------
     MAIN BUILD FUNCTION
     ------------------------------------------------------------ */
  function build(scene){
    const handles = {
      ground: null,
      pitch: null,
      boundary: null,
      ledRibbon: null,
      roof: null,
      sightScreens: [],
      jumbotrons: [],
      floodlights: [],
      floodTowers: [],
      crowdMeshes: [],
      seatMeshes: [],
      ledTexture: null
    };

    const grassTex = makeGrassTexture();
    const pitchTex = makePitchTexture();
    const woodTex  = makeWoodTexture();
    const ledTex   = makeLEDTexture();
    ledTex.wrapS = THREE.RepeatWrapping;
    ledTex.repeat.set(8, 1);
    handles.ledTexture = ledTex;

    /* ---------- Ground ---------- */
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(68, 96),
      new THREE.MeshStandardMaterial({ map: grassTex, roughness: 0.9, metalness: 0.0 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    handles.ground = ground;

    /* ---------- Pitch ---------- */
    const pitch = new THREE.Mesh(
      new THREE.PlaneGeometry(3.6, 22.2),
      new THREE.MeshStandardMaterial({ map: pitchTex, roughness: 0.92 })
    );
    pitch.rotation.x = -Math.PI / 2;
    pitch.position.y = 0.02;
    pitch.receiveShadow = true;
    scene.add(pitch);
    handles.pitch = pitch;

    /* ---------- Crease markings ---------- */
    function creaseLine(x, z, w, h, color = 0xffffff){
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(w, h),
        new THREE.MeshBasicMaterial({ color })
      );
      m.rotation.x = -Math.PI / 2;
      m.position.set(x, 0.03, z);
      scene.add(m);
    }
    // Batting crease (striker end at z=+10)
    creaseLine(0,  8.8, 3.6, 0.12);
    creaseLine(0, 10.0, 2.64, 0.08);
    creaseLine(-1.32,  9.4, 0.1, 1.2);
    creaseLine( 1.32,  9.4, 0.1, 1.2);
    // Bowling crease (bowler end at z=-10)
    creaseLine(0, -8.8, 3.6, 0.12);
    creaseLine(0, -10.0, 2.64, 0.08);
    creaseLine(-1.32, -9.4, 0.1, 1.2);
    creaseLine( 1.32, -9.4, 0.1, 1.2);

    /* ---------- Inner circle ---------- */
    const innerRing = new THREE.Mesh(
      new THREE.RingGeometry(27.4, 27.7, 96),
      new THREE.MeshBasicMaterial({ color: 0xffffff, opacity: 0.32, transparent: true, side: THREE.DoubleSide })
    );
    innerRing.rotation.x = -Math.PI / 2;
    innerRing.position.y = 0.015;
    scene.add(innerRing);

    /* ---------- Boundary rope ---------- */
    const ropeTex = texCanvas(256, 32, (ctx, w, h) => {
      ctx.fillStyle = '#e2e8f0'; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 4;
      for (let x = 0; x < w; x += 16){
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 12, h); ctx.stroke();
      }
    });
    ropeTex.wrapS = THREE.RepeatWrapping;
    ropeTex.repeat.set(64, 1);

    const boundary = new THREE.Mesh(
      new THREE.TorusGeometry(62, 0.22, 12, 160),
      new THREE.MeshStandardMaterial({ map: ropeTex, roughness: 0.6 })
    );
    boundary.rotation.x = -Math.PI / 2;
    boundary.position.y = 0.12;
    boundary.castShadow = true;
    scene.add(boundary);
    handles.boundary = boundary;

    /* ---------- LED advertising ribbon ---------- */
    const ledRibbon = new THREE.Mesh(
      new THREE.CylinderGeometry(63.4, 63.4, 1.3, 128, 1, true),
      new THREE.MeshBasicMaterial({ map: ledTex, side: THREE.BackSide })
    );
    ledRibbon.position.y = 0.65;
    scene.add(ledRibbon);
    handles.ledRibbon = ledRibbon;

    /* ---------- 3-tier stands with individual seat blocks ---------- */
    const seatColors = [0x0f172a, 0x1e293b, 0x334155];
    for (let tier = 0; tier < 3; tier++){
      const radiusBase = 64 + tier * 8;
      const tierHeight = 5;
      const tierY = tier * 5;

      const stand = new THREE.Mesh(
        new THREE.CylinderGeometry(radiusBase + 8, radiusBase, tierHeight, 96, 1, true),
        new THREE.MeshStandardMaterial({ color: seatColors[tier], roughness: 0.75, side: THREE.DoubleSide })
      );
      stand.position.y = tierY + tierHeight/2;
      scene.add(stand);

      // Instanced seat rows
      const seatGeo = new THREE.BoxGeometry(0.55, 0.45, 0.55);
      const seatMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.7 });
      for (let ring = 0; ring < 5; ring++){
        const ringR = radiusBase + 1.5 + ring * 1.5;
        const ringY = tierY + 0.5 + ring * 0.95;
        const seatCount = Math.floor((Math.PI * 2 * ringR) / 0.85);
        const inst = new THREE.InstancedMesh(seatGeo, seatMat, seatCount);
        for (let s = 0; s < seatCount; s++){
          const a = (s / seatCount) * Math.PI * 2;
          const m = new THREE.Matrix4();
          m.setPosition(Math.cos(a)*ringR, ringY, Math.sin(a)*ringR);
          inst.setMatrixAt(s, m);
        }
        scene.add(inst);
        handles.seatMeshes.push(inst);
      }

      // Parapet wall
      const parapet = new THREE.Mesh(
        new THREE.TorusGeometry(radiusBase + 8, 0.28, 8, 128),
        new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.6, metalness: 0.3 })
      );
      parapet.rotation.x = Math.PI / 2;
      parapet.position.y = tierY + tierHeight;
      scene.add(parapet);
    }

    /* ---------- Roof canopy ---------- */
    const roof = new THREE.Mesh(
      new THREE.RingGeometry(64, 96, 128, 1, 0, Math.PI * 2),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.35, metalness: 0.5, side: THREE.DoubleSide })
    );
    roof.rotation.x = -Math.PI / 2;
    roof.position.y = 22;
    scene.add(roof);
    handles.roof = roof;

    /* ---------- 24 roof beams ---------- */
    for (let i = 0; i < 24; i++){
      const a = (i / 24) * Math.PI * 2;
      const beam = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.5, 32),
        new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8, roughness: 0.3 })
      );
      beam.position.set(Math.cos(a) * 80, 21.8, Math.sin(a) * 80);
      beam.lookAt(0, 21.8, 0);
      scene.add(beam);
    }

    /* ---------- Crowd (instanced colored boxes) ---------- */
    (function buildCrowd(){
      const crowdPalette = [0xe5534b, 0xe8b04a, 0x48a8c4, 0x9b6dd0, 0x4eb87a, 0xd9629e, 0xdcc24a, 0x5f7fd9];
      const crowdGeo = new THREE.BoxGeometry(0.22, 0.4, 0.22);
      for (let tier = 0; tier < 3; tier++){
        const radiusBase = 64 + tier * 8;
        const tierY = tier * 5;
        for (let ring = 0; ring < 6; ring++){
          const ringR = radiusBase + 1 + ring * 1.6;
          const ringY = tierY + 0.7 + ring * 0.9;
          const count = Math.floor((Math.PI * 2 * ringR) / 0.65);
          const inst = new THREE.InstancedMesh(
            crowdGeo,
            new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.75 }),
            count
          );
          const color = new THREE.Color();
          for (let s = 0; s < count; s++){
            const a = (s / count) * Math.PI * 2;
            const m = new THREE.Matrix4();
            m.setPosition(Math.cos(a)*ringR, ringY, Math.sin(a)*ringR);
            inst.setMatrixAt(s, m);
            color.setHex(crowdPalette[Math.floor(Math.random() * crowdPalette.length)]);
            inst.setColorAt(s, color);
          }
          scene.add(inst);
          handles.crowdMeshes.push(inst);
        }
      }
    })();

    /* ---------- Sight screens (both ends) ---------- */
    function buildSightScreen(z, flip){
      const group = new THREE.Group();
      const back = new THREE.Mesh(
        new THREE.BoxGeometry(15, 7, 0.6),
        new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5 })
      );
      back.position.y = 3.5; back.castShadow = true;
      group.add(back);
      for (let s = 0; s < 10; s++){
        const slat = new THREE.Mesh(
          new THREE.PlaneGeometry(1.35, 6.5),
          new THREE.MeshBasicMaterial({ color: 0xf8fafc })
        );
        slat.position.set(-6.2 + s * 1.38, 3.5, flip ? -0.32 : 0.32);
        if (flip) slat.rotation.y = Math.PI;
        group.add(slat);
      }
      group.position.set(0, 0, z);
      scene.add(group);
      handles.sightScreens.push(group);
    }
    buildSightScreen(-64, false);
    buildSightScreen( 64, true);

    /* ---------- Jumbotrons (4 corners) ---------- */
    function buildJumbotron(x, z, rotY){
      const group = new THREE.Group();
      const frame = new THREE.Mesh(
        new THREE.BoxGeometry(18, 10, 1.4),
        new THREE.MeshStandardMaterial({ color: 0x090d16, roughness: 0.4, metalness: 0.6 })
      );
      frame.position.y = 5; group.add(frame);

      const screenMat = new THREE.MeshBasicMaterial({ color: 0x0284c7 });
      const screen = new THREE.Mesh(new THREE.PlaneGeometry(17, 9), screenMat);
      screen.position.set(0, 5, 0.72);
      group.add(screen);
      group.userData.screenMat = screenMat;

      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.5, 0.7, 26, 10),
        new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8, roughness: 0.3 })
      );
      pole.position.y = -8;
      group.add(pole);

      group.position.set(x, 23, z);
      group.rotation.y = rotY;
      scene.add(group);
      return group;
    }
    handles.jumbotrons.push(buildJumbotron(-64, 0,  Math.PI/2));
    handles.jumbotrons.push(buildJumbotron( 64, 0, -Math.PI/2));

    /* ---------- Floodlight towers + spotlights ---------- */
    [[-55,-55],[55,-55],[-55,55],[55,55]].forEach(([x,z])=>{
      const tower = new THREE.Group();
      tower.position.set(x, 0, z);

      const steelMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.75, roughness: 0.35 });

      // 4 main columns
      for (let c = 0; c < 4; c++){
        const ang = (c * Math.PI) / 2;
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.4, 44, 8), steelMat);
        col.position.set(Math.cos(ang)*1.8, 22, Math.sin(ang)*1.8);
        col.castShadow = true;
        tower.add(col);
      }
      // Cross-brace rings
      for (let y = 4; y <= 42; y += 4){
        const ring = new THREE.Mesh(new THREE.TorusGeometry(1.8, 0.09, 6, 8), steelMat);
        ring.rotation.x = Math.PI / 2;
        ring.position.y = y;
        tower.add(ring);
      }
      // Diagonal braces
      for (let s = 0; s < 4; s++){
        const ang = (s * Math.PI) / 2 + Math.PI / 4;
        for (let y = 2; y < 42; y += 6){
          const brace = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 6, 5), steelMat);
          brace.position.set(Math.cos(ang)*1.8, y + 3, Math.sin(ang)*1.8);
          brace.rotation.z = Math.PI / 4;
          tower.add(brace);
        }
      }

      // Lamp panel with 15 lamps in 3×5 grid
      const panel = new THREE.Group();
      const panelBack = new THREE.Mesh(
        new THREE.BoxGeometry(10, 5.5, 1.0),
        new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4, metalness: 0.6 })
      );
      panel.add(panelBack);

      const lampMat = new THREE.MeshBasicMaterial({ color: 0xfffaea });
      const lampGeo = new THREE.CircleGeometry(0.55, 16);
      for (let ry = 0; ry < 3; ry++){
        for (let rx = 0; rx < 5; rx++){
          const lamp = new THREE.Mesh(lampGeo, lampMat);
          lamp.position.set(-4 + rx * 2, -1.2 + ry * 1.2, 0.55);
          panel.add(lamp);

          const glow = new THREE.Mesh(
            new THREE.CircleGeometry(0.9, 16),
            new THREE.MeshBasicMaterial({ color: 0xfff6d0, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false })
          );
          glow.position.set(lamp.position.x, lamp.position.y, 0.56);
          panel.add(glow);
        }
      }
      panel.position.set(0, 44, 0);
      panel.lookAt(0, 0, 0);
      tower.add(panel);

      // Real spotlight
      const spot = new THREE.SpotLight(0xfff6e0, 1.5, 200, Math.PI / 3, 0.4, 1.1);
      spot.position.set(x, 44, z);
      spot.target.position.set(0, 0, 0);
      spot.castShadow = true;
      spot.shadow.mapSize.set(1024, 1024);
      scene.add(spot);
      scene.add(spot.target);
      handles.floodlights.push(spot);

      scene.add(tower);
      handles.floodTowers.push(tower);
    });

    /* ---------- Ambient + Sun light (stadium-owned) ---------- */
    const ambient = new THREE.AmbientLight(0xd4e2ff, 0.5);
    scene.add(ambient);
    handles.ambient = ambient;

    const sun = new THREE.DirectionalLight(0xfff5e6, 0);
    sun.position.set(40, 80, 40);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -80;
    sun.shadow.camera.right = 80;
    sun.shadow.camera.top = 80;
    sun.shadow.camera.bottom = -80;
    scene.add(sun);
    handles.sun = sun;

    /* ---------- Sky preset switcher ---------- */
    handles.setSky = function(mode){
      if (mode === 'day'){
        scene.background.set(0x87ceeb);
        scene.fog.color.set(0xbfe3f7);
        ambient.color.set(0xffffff); ambient.intensity = 0.9;
        sun.intensity = 1.6;
        handles.floodlights.forEach(f => f.intensity = 0.0);
      } else if (mode === 'sunset'){
        scene.background.set(0xfd5e53);
        scene.fog.color.set(0x3e1d35);
        ambient.color.set(0xffa07a); ambient.intensity = 0.65;
        sun.intensity = 0.75;
        handles.floodlights.forEach(f => f.intensity = 0.85);
      } else {
        scene.background.set(0x020713);
        scene.fog.color.set(0x050d24);
        ambient.color.set(0xd4e2ff); ambient.intensity = 0.45;
        sun.intensity = 0.0;
        handles.floodlights.forEach(f => f.intensity = 1.5);
      }
    };

    /* ---------- Per-frame update ---------- */
    handles.update = function(dt, elapsed){
      // Jumbotron color cycle
      const hue = (Math.sin(elapsed * 0.6) + 1) / 2;
      handles.jumbotrons.forEach(j => {
        if (j.userData.screenMat){
          j.userData.screenMat.color.setHSL(0.55 + hue * 0.15, 0.7, 0.45 + hue * 0.1);
        }
      });
      // LED texture scroll
      if (handles.ledTexture){
        handles.ledTexture.offset.x = (elapsed * 0.02) % 1;
      }
    };

    console.log('🏟️ Stadium built —',
      handles.seatMeshes.length + handles.crowdMeshes.length,
      'instanced meshes,', handles.floodlights.length, 'floodlights');
    return handles;
  }

  /* ------------------------------------------------------------
     EXPORT
     ------------------------------------------------------------ */
  window.CricMaxStadium = {
    build: build,
    makeWoodTexture: makeWoodTexture
  };
})();

/* ============================================================
   CricMax Pro — Stadium Detail Enhancer
   Animated LED ribbons, sponsor boards, jumbotron content,
   camera flashes in the crowd
   Exposes: window.CricMaxStadiumDetail
   ============================================================ */
(function(){
  'use strict';

  function texCanvas(w, h, draw){
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    return new THREE.CanvasTexture(c);
  }

  /* ---------------- LED RIBBON TEXTURE ---------------- */
  function buildLedRibbonTexture(){
    const c = document.createElement('canvas');
    c.width = 2048; c.height = 128;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#0a0f18'; ctx.fillRect(0, 0, 2048, 128);
    const brands = ['CRICMAX PRO', 'LIVE ACTION', 'BOUNDARY CAM', 'SMART REVIEW', '6 OR OUT', 'HOWZAT!', 'TATA IPL', 'WAGON WHEEL'];
    ctx.font = 'bold 52px -apple-system,sans-serif';
    ctx.textBaseline = 'middle';
    brands.forEach((b, i) => {
      const x = i * 260;
      ctx.fillStyle = i % 2 ? '#38bdf8' : '#00e676';
      ctx.fillText(b, x, 64);
    });
    const t = new THREE.CanvasTexture(c);
    t.wrapS = THREE.RepeatWrapping;
    t.repeat.set(6, 1);
    return t;
  }

  /* ---------------- JUMBOTRON TEXTURE ---------------- */
  function buildJumbotronTexture(teamAbbr){
    return texCanvas(512, 288, (ctx, w, h) => {
      ctx.fillStyle = '#001624';
      ctx.fillRect(0, 0, w, h);
      // gradient bg
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, '#0a2a3e');
      g.addColorStop(1, '#02111a');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      // Stadium LED pattern
      for (let i = 0; i < 30; i++){
        ctx.fillStyle = `rgba(${Math.random() * 200 + 55}, ${Math.random() * 200 + 55}, ${Math.random() * 200 + 55}, 0.08)`;
        ctx.fillRect(0, Math.random() * h, w, 8);
      }
      // big score
      ctx.fillStyle = '#00e676';
      ctx.font = 'bold 90px -apple-system,sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('LIVE', w/2, h/2);
      ctx.fillStyle = '#22d3ee';
      ctx.font = 'bold 26px -apple-system,sans-serif';
      ctx.fillText(teamAbbr || 'CRICMAX', w/2, h/2 + 50);
    });
  }

  /* ---------------- CAMERA FLASHES ---------------- */
  function buildCameraFlashes(scene){
    const N = 60;
    const flashTex = texCanvas(32, 32, (ctx, w, h) => {
      const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.5, 'rgba(255,240,200,0.6)');
      g.addColorStop(1, 'rgba(255,200,100,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    });
    const sprites = [];
    for (let i = 0; i < N; i++){
      const s = new THREE.Sprite(new THREE.SpriteMaterial({
        map: flashTex, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false
      }));
      s.scale.setScalar(1.6);
      // Random position around crowd rings
      const ang = Math.random() * Math.PI * 2;
      const r = 65 + Math.random() * 20;
      const y = 2 + Math.random() * 12;
      s.position.set(Math.cos(ang) * r, y, Math.sin(ang) * r);
      s.userData = { timer: Math.random() * 3, maxTimer: 3, flashLife: 0 };
      scene.add(s);
      sprites.push(s);
    }
    return sprites;
  }

  /* ------------------------------------------------------------
     PUBLIC: BUILD
     ------------------------------------------------------------ */
  function build(scene, renderer){
    const handle = {};
    const ledTex = buildLedRibbonTexture();

    /* ---------------- FLOOR LED RIBBON ---------------- */
    const ledRibbon = new THREE.Mesh(
      new THREE.CylinderGeometry(63.5, 63.5, 1.4, 128, 1, true),
      new THREE.MeshBasicMaterial({ map: ledTex, side: THREE.BackSide })
    );
    ledRibbon.position.y = 0.7;
    scene.add(ledRibbon);
    handle.ledRibbon = ledRibbon;

    /* ---------------- SPONSOR BOARDS at stands level ---------------- */
    const boardTextures = [
      'CRICMAX', 'TATA IPL', 'LIVE NOW', 'BOUNDARY', 'SMART REVIEW'
    ];
    const boardGroup = new THREE.Group();
    boardTextures.forEach((text, i) => {
      const tex = texCanvas(512, 128, (ctx, w, h) => {
        ctx.fillStyle = ['#c0392b', '#2c3e50', '#0d4f8b', '#117a45', '#8e44ad'][i];
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 68px -apple-system,sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, w/2, h/2);
      });
      const ang = (i / boardTextures.length) * Math.PI * 2;
      const boardMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(16, 4),
        new THREE.MeshBasicMaterial({ map: tex })
      );
      boardMesh.position.set(Math.cos(ang) * 84, 14, Math.sin(ang) * 84);
      boardMesh.lookAt(0, 14, 0);
      boardGroup.add(boardMesh);
    });
    scene.add(boardGroup);
    handle.sponsorBoards = boardGroup;

    /* ---------------- CAMERA FLASHES ---------------- */
    const flashes = buildCameraFlashes(scene);
    handle.flashes = flashes;

    /* ---------------- JUMBOTRON CONTENT ---------------- */
    const jumboTexes = [];
    ['LIVE', 'REPLAY', 'CRICMAX', 'INNINGS'].forEach(label => {
      const tex = texCanvas(512, 288, (ctx, w, h) => {
        const g = ctx.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, '#003366');
        g.addColorStop(1, '#001122');
        ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#00e676';
        ctx.font = 'bold 80px -apple-system,sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, w/2, h/2);
        ctx.strokeStyle = '#22d3ee';
        ctx.lineWidth = 6;
        ctx.strokeRect(10, 10, w - 20, h - 20);
      });
      jumboTexes.push(tex);
    });
    handle.jumboTextureCycle = jumboTexes;

    /* ---------------- PUBLIC METHODS ---------------- */
    handle.update = function(dt, elapsed){
      // Scroll LED ribbon
      if (ledTex) ledTex.offset.x = (elapsed * 0.06) % 1;

      // Camera flashes — random pop
      flashes.forEach(f => {
        f.userData.timer -= dt;
        if (f.userData.flashLife > 0){
          f.userData.flashLife -= dt;
          f.material.opacity = Math.max(0, f.userData.flashLife * 2);
        } else if (f.userData.timer <= 0){
          if (Math.random() < 0.15){
            f.userData.flashLife = 0.15;
            f.material.opacity = 1;
            const ang = Math.random() * Math.PI * 2;
            const r = 65 + Math.random() * 20;
            const y = 2 + Math.random() * 12;
            f.position.set(Math.cos(ang) * r, y, Math.sin(ang) * r);
          }
          f.userData.timer = 0.2 + Math.random() * 3;
        }
      });
    };

    handle.setJumboTexture = function(mesh, idx){
      if (!mesh || !mesh.userData.screenMat) return;
      const tex = jumboTexes[idx % jumboTexes.length];
      mesh.userData.screenMat.map = tex;
      mesh.userData.screenMat.needsUpdate = true;
    };

    console.log('🏟️ Stadium detail enhanced');
    return handle;
  }

  window.CricMaxStadiumDetail = { build };
})();
